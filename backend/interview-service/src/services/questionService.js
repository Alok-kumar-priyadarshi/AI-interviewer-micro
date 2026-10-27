import { and, eq } from "drizzle-orm";
import { env } from "../config/env.js";
import { chatStream, chatText } from "../clients/groq.js";
import { searchResume } from "../clients/services.js";
import { db, isUniqueViolation } from "../db/client.js";
import { sessions, turns } from "../db/schema.js";
import { AppError } from "../lib/AppError.js";
import { logger } from "../lib/logger.js";
import { checkOutput } from "../lib/outputGuard.js";
import { buildQuestionPrompt } from "../prompts/questionPrompt.js";
import { decideNext } from "./flow.js";
import { getOwnedSessionWithTurns, sessionCompleted } from "./sessionService.js";

/** Strips labels, quotes and extra whitespace the model sometimes adds around a question. */
export function cleanQuestion(text) {
  return String(text ?? "")
    .replace(/^\s*(question|q|alex)\s*[:.-]\s*/i, "")
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 600);
}

export function isAcceptableQuestion(text, canary) {
  return checkOutput(text, { canary }).ok && text.length >= 10 && text.length <= 600 && text.includes("?");
}

export function fallbackQuestion(item, followUp) {
  if (followUp) {
    return followUp.angle
      ? `Could you go a little deeper on that, specifically: ${followUp.angle.replace(/[.?]+$/, "")}?`
      : "Could you go a little deeper on your previous answer, with a concrete example?";
  }
  return `Can you walk me through ${item.topic}, focusing on ${item.focus.replace(/[.?]+$/, "")}?`;
}

function startNdjson(res) {
  res.status(200);
  res.setHeader("content-type", "application/x-ndjson; charset=utf-8");
  res.setHeader("cache-control", "no-cache, no-transform");
  res.setHeader("x-accel-buffering", "no");
  return (event) => res.write(`${JSON.stringify(event)}\n`);
}

function writeExistingTurn(res, session, turn) {
  const send = startNdjson(res);
  send({ type: "start", turnIndex: turn.idx, category: turn.category, isFollowUp: turn.isFollowUp, planItem: turn.planItem, totalItems: session.plan.length });
  send({ type: "delta", text: turn.questionText });
  send({ type: "done", turnId: turn.id, questionText: turn.questionText });
  res.end();
}

/**
 * Streams the next question as NDJSON. If the latest question is still unanswered it is sent
 * again (so a page refresh never skips a question). The model call is opened before any byte
 * is written, so an unavailable model still produces a normal JSON 503.
 */
export async function streamNextQuestion({ userId, sessionId, requestId }, res) {
  const { session, turns: history } = await getOwnedSessionWithTurns(userId, sessionId);
  if (session.status === "completed") throw sessionCompleted();
  const next = decideNext(session, history);

  if (next.action === "pending") return writeExistingTurn(res, session, next.turn);
  if (next.action === "complete") throw new AppError("NO_MORE_QUESTIONS", 409, "All questions have been asked");

  const item = session.plan[next.planItem];
  const followUp = next.action === "follow_up" ? { angle: next.parent.feedback?.followUpAngle ?? null } : null;
  const chunks = await searchResume(session.resumeId, userId, `${item.topic}. ${item.focus}`, env.RAG_TOP_K, requestId);
  const prompt = buildQuestionPrompt({
    level: session.level,
    item,
    followUp,
    profileSummary: session.profileSummary,
    chunks,
    recentTurns: history.slice(-2),
    askedQuestions: history.map((t) => t.questionText),
  });

  const { stream } = await chatStream({
    task: followUp ? "follow_up_question" : "question",
    models: [env.GROQ_MODEL_FAST, env.GROQ_MODEL_MAIN],
    messages: prompt.messages,
    temperature: 0.7,
    maxTokens: 700,
  });

  const send = startNdjson(res);
  send({
    type: "start",
    turnIndex: history.length,
    category: item.category,
    isFollowUp: Boolean(followUp),
    planItem: next.planItem,
    totalItems: session.plan.length,
  });

  let raw = "";
  try {
    for await (const delta of stream) {
      raw += delta;
      send({ type: "delta", text: delta });
    }
  } catch (err) {
    logger.warn("question_stream_broken", { requestId, err: err?.message });
    send({ type: "error", code: "AI_BUSY", message: "The AI is busy right now. Please try again in a minute" });
    return res.end();
  }

  let questionText = cleanQuestion(raw);
  if (!isAcceptableQuestion(questionText, prompt.canary)) {
    logger.warn("question_rejected", { requestId, length: questionText.length });
    questionText = await regenerate(prompt, item, followUp);
    send({ type: "replace", questionText });
  }

  const touchSession = () =>
    db
      .update(sessions)
      .set({
        status: "in_progress",
        currentItem: next.planItem,
        lastActivityAt: new Date(),
        startedAt: session.startedAt ?? new Date(),
      })
      .where(eq(sessions.id, session.id));

  let turn;
  try {
    // One round trip (and one transaction) for the new turn and the session update.
    [[turn]] = await db.batch([
      db
        .insert(turns)
        .values({
          sessionId: session.id,
          idx: history.length,
          planItem: next.planItem,
          category: item.category,
          isFollowUp: Boolean(followUp),
          parentTurnId: followUp ? next.parent.id : null,
          questionText,
          sourceChunkIds: chunks.map((c) => c.id),
        })
        .returning(),
      touchSession(),
    ]);
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    // A concurrent request created this turn first; serve that one instead.
    [[turn]] = await db.batch([
      db
        .select()
        .from(turns)
        .where(and(eq(turns.sessionId, session.id), eq(turns.idx, history.length))),
      touchSession(),
    ]);
    send({ type: "replace", questionText: turn.questionText });
  }

  send({ type: "done", turnId: turn.id, questionText: turn.questionText });
  res.end();
}

async function regenerate(prompt, item, followUp) {
  try {
    const { content } = await chatText({
      task: "question_retry",
      models: [env.GROQ_MODEL_MAIN, env.GROQ_MODEL_FAST],
      messages: prompt.messages,
      temperature: 0.5,
      maxTokens: 700,
    });
    const text = cleanQuestion(content);
    if (isAcceptableQuestion(text, prompt.canary)) return text;
  } catch {
    // fall through to the template question
  }
  return fallbackQuestion(item, followUp);
}
