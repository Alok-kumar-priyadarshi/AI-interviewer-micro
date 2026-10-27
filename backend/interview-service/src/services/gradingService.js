import { and, eq, isNull } from "drizzle-orm";
import { env } from "../config/env.js";
import { chatJson } from "../clients/groq.js";
import { guardCheck, searchResume } from "../clients/services.js";
import { db } from "../db/client.js";
import { sessions, turns } from "../db/schema.js";
import { AppError } from "../lib/AppError.js";
import { checkJsonOutput } from "../lib/outputGuard.js";
import { sanitizeText } from "../lib/sanitize.js";
import { buildGradingPrompt, gradingJsonSchema, gradingZodSchema } from "../prompts/gradingPrompt.js";
import { computeScore, decideNext } from "./flow.js";
import { getOwnedSessionWithTurns, notFound, sessionCompleted } from "./sessionService.js";

const alreadyAnswered = () =>
  new AppError("TURN_ALREADY_ANSWERED", 409, "This question was already answered");

const BLOCKED_FEEDBACK = {
  strengths: [],
  gaps: ["The answer contained instructions to the AI and was not evaluated."],
  idealAnswerHints: [],
  needsFollowUp: false,
  followUpAngle: null,
  integrity: "manipulation_attempt",
};

async function grade(session, turn, answerText, userId, requestId) {
  const item = session.plan[turn.planItem];
  const chunks = await searchResume(session.resumeId, userId, turn.questionText, 2, requestId);
  const prompt = buildGradingPrompt({
    level: session.level,
    item,
    questionText: turn.questionText,
    answerText,
    chunks,
    profileSummary: session.profileSummary,
  });
  const { data } = await chatJson({
    task: "grading",
    models: [env.GROQ_MODEL_MAIN, env.GROQ_MODEL_FAST],
    messages: prompt.messages,
    jsonSchema: gradingJsonSchema,
    zodSchema: gradingZodSchema,
    temperature: 0.1,
    maxTokens: 1500,
  });
  if (!checkJsonOutput(data, { canary: prompt.canary }).ok) {
    throw new AppError("AI_BUSY", 503, "The AI is busy right now. Please try again in a minute");
  }

  const rubric = { correctness: data.correctness, depth: data.depth, communication: data.communication };
  return {
    rubric,
    score: data.manipulationAttempt ? 0 : computeScore(rubric),
    feedback: {
      strengths: data.strengths,
      gaps: data.gaps,
      idealAnswerHints: data.idealAnswerHints,
      needsFollowUp: data.manipulationAttempt ? false : data.needsFollowUp,
      followUpAngle: data.followUpAngle,
      integrity: data.manipulationAttempt ? "manipulation_attempt" : null,
    },
  };
}

/**
 * Stores and grades an answer, then says what comes next. Scores are not returned:
 * they appear only in the final report.
 */
export async function submitAnswer({ userId, sessionId, turnId, input, requestId }) {
  const { session, turns: history } = await getOwnedSessionWithTurns(userId, sessionId);
  if (session.status === "completed") throw sessionCompleted();
  const turn = history.find((t) => t.id === turnId);
  if (!turn) throw notFound();
  if (turn.answeredAt) throw alreadyAnswered();

  const answerText = sanitizeText(input.answerText, 4000);
  if (!answerText) throw new AppError("VALIDATION_ERROR", 400, "Answer cannot be empty");
  const isVoice = input.answerMode === "voice";

  const guard = await guardCheck(answerText, requestId);
  const blocked = guard.verdict === "block";
  const evaluation = blocked
    ? { rubric: null, score: 0, feedback: BLOCKED_FEEDBACK }
    : await grade(session, turn, guard.sanitizedText || answerText, userId, requestId);

  // One round trip: save the answer (only if still unanswered) and touch the session.
  const [[updated]] = await db.batch([
    db
      .update(turns)
      .set({
        answerText,
        answerMode: input.answerMode,
        transcriptRaw: isVoice && input.transcriptRaw ? sanitizeText(input.transcriptRaw, 6000) : null,
        audioDurationSec: isVoice && input.audioDurationSec != null ? Number(input.audioDurationSec.toFixed(1)) : null,
        rubric: evaluation.rubric,
        score: evaluation.score,
        feedback: evaluation.feedback,
        guardVerdict: guard.verdict,
        guardFlags: guard.reasons ?? [],
        answeredAt: new Date(),
      })
      .where(and(eq(turns.id, turn.id), isNull(turns.answeredAt)))
      .returning(),
    db
      .update(sessions)
      .set({ status: "in_progress", lastActivityAt: new Date() })
      .where(eq(sessions.id, session.id)),
  ]);
  if (!updated) throw alreadyAnswered();

  const decision = decideNext(session, history.map((t) => (t.id === updated.id ? updated : t)));
  return { action: decision.action, blocked };
}
