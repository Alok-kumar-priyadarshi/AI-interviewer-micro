import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, lt, ne } from "drizzle-orm";
import { env } from "../config/env.js";
import { chatJson } from "../clients/groq.js";
import { db, isUniqueViolation } from "../db/client.js";
import { reportItems, reports } from "../db/schema.js";
import { AppError } from "../lib/AppError.js";
import { checkJsonOutput } from "../lib/outputGuard.js";
import { buildReportPrompt, narrativeJsonSchema, narrativeZodSchema } from "../prompts/reportPrompt.js";
import { computeComparison, computeNumbers } from "./scoring.js";

const notFound = () => new AppError("NOT_FOUND", 404, "Not found");
const INTEGRITY_NOTE = "Your answer contained instructions to the AI and was not evaluated.";

async function writeNarrative({ level, profileSummary, numbers, turns }) {
  const answered = turns.filter((t) => t.answerText);
  if (!answered.length) {
    return {
      model: "none",
      narrative: {
        summary: "This interview ended before any question was answered, so there is nothing to score yet.",
        strengths: [],
        improvements: [],
        recommendedTopics: [...new Set(turns.map((t) => t.topic).filter(Boolean))].slice(0, 6),
        perItemHints: [],
      },
    };
  }
  const prompt = buildReportPrompt({ level, profileSummary, numbers, turns });
  const { data, model } = await chatJson({
    task: "report_narrative",
    models: [env.GROQ_MODEL_MAIN, env.GROQ_MODEL_FALLBACK],
    messages: prompt.messages,
    jsonSchema: narrativeJsonSchema,
    zodSchema: narrativeZodSchema,
    temperature: 0.3,
    maxTokens: 4000,
    reasoningEffort: "medium",
  });
  if (!checkJsonOutput(data, { canary: prompt.canary }).ok) {
    throw new AppError("AI_BUSY", 503, "The AI is busy right now. Please try again in a minute");
  }
  return { narrative: data, model };
}

async function findBySession(sessionId) {
  const [row] = await db.select({ id: reports.id }).from(reports).where(eq(reports.sessionId, sessionId)).limit(1);
  return row ?? null;
}

/**
 * Builds and stores the report for a finished interview. Idempotent per session: a second call
 * returns the existing report id. Numbers come from code; the model writes only the narrative.
 */
export async function createReport(userId, { session, profileSummary, turns }) {
  if (session.userId !== userId) {
    throw new AppError("VALIDATION_ERROR", 400, "Session does not belong to the calling user");
  }
  const existing = await findBySession(session.id);
  if (existing) return { reportId: existing.id };

  const ordered = [...turns].sort((a, b) => a.idx - b.idx);
  const numbers = computeNumbers(ordered);
  const { narrative, model } = await writeNarrative({ level: session.level, profileSummary, numbers, turns: ordered });

  const previous = await db
    .select()
    .from(reports)
    .where(and(eq(reports.userId, userId), ne(reports.sessionId, session.id)))
    .orderBy(desc(reports.createdAt))
    .limit(20);
  const comparison = computeComparison(previous, {
    ...numbers,
    sessionId: session.id,
    level: session.level,
    date: new Date().toISOString().slice(0, 10),
    improvements: narrative.improvements,
  });

  const hintsByIdx = new Map(narrative.perItemHints.map((h) => [h.idx, h.hints]));
  const integrityNotes = ordered
    .filter((t) => t.guardVerdict === "block" || t.feedback?.integrity)
    .map((t) => ({ idx: t.idx, note: INTEGRITY_NOTE }));

  const reportId = randomUUID();
  try {
    await db.batch([
      db.insert(reports).values({
        id: reportId,
        sessionId: session.id,
        userId,
        resumeId: session.resumeId,
        level: session.level,
        questionsAnswered: numbers.questionsAnswered,
        overallScore: numbers.overallScore,
        categoryScores: numbers.categoryScores,
        summary: narrative.summary,
        strengths: narrative.strengths,
        improvements: narrative.improvements,
        recommendedTopics: narrative.recommendedTopics,
        integrityNotes,
        comparison,
        profileSummary: profileSummary ?? {},
        modelUsed: model,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
      }),
      db.insert(reportItems).values(
        ordered.map((t) => ({
          reportId,
          idx: t.idx,
          category: t.category,
          topic: t.topic?.slice(0, 120) ?? null,
          isFollowUp: t.isFollowUp,
          question: t.questionText,
          answerText: t.answerText,
          answerMode: t.answerMode,
          transcriptRaw: t.transcriptRaw,
          audioDurationSec: t.audioDurationSec,
          rubric: t.rubric,
          score: t.score,
          strengths: t.feedback?.strengths ?? [],
          gaps: t.feedback?.gaps ?? [],
          idealAnswerHints: hintsByIdx.get(t.idx) ?? t.feedback?.idealAnswerHints ?? [],
          guardVerdict: t.guardVerdict,
        })),
      ),
    ]);
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    const raced = await findBySession(session.id);
    if (raced) return { reportId: raced.id };
    throw err;
  }
  return { reportId };
}

const summaryFields = {
  id: reports.id,
  sessionId: reports.sessionId,
  level: reports.level,
  overallScore: reports.overallScore,
  questionsAnswered: reports.questionsAnswered,
  categoryScores: reports.categoryScores,
  createdAt: reports.createdAt,
};

export async function listReports(userId, { limit, cursor }) {
  const where = cursor
    ? and(eq(reports.userId, userId), lt(reports.createdAt, new Date(cursor)))
    : eq(reports.userId, userId);
  const rows = await db
    .select(summaryFields)
    .from(reports)
    .where(where)
    .orderBy(desc(reports.createdAt))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  return { items: page, nextCursor: rows.length > limit ? page.at(-1).createdAt.toISOString() : null };
}

export async function getReportBySession(userId, sessionId) {
  const [report] = await db
    .select()
    .from(reports)
    .where(and(eq(reports.sessionId, sessionId), eq(reports.userId, userId)))
    .limit(1);
  if (!report) throw notFound();
  const items = await db
    .select()
    .from(reportItems)
    .where(eq(reportItems.reportId, report.id))
    .orderBy(asc(reportItems.idx));
  return { report, items: items.map(({ reportId: _reportId, ...item }) => item) };
}
