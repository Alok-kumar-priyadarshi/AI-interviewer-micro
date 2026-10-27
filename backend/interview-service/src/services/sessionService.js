import { and, asc, desc, eq, lt } from "drizzle-orm";
import { env } from "../config/env.js";
import { chatJson } from "../clients/groq.js";
import { createReport, getResumeProfile } from "../clients/services.js";
import { db } from "../db/client.js";
import { sessions, turns } from "../db/schema.js";
import { AppError } from "../lib/AppError.js";
import { checkJsonOutput } from "../lib/outputGuard.js";
import { buildPlanPrompt, planJsonSchema, planZodSchema } from "../prompts/planPrompt.js";
import { effectiveStatus } from "./flow.js";
import { normalizePlan } from "./planRules.js";

export const notFound = () => new AppError("NOT_FOUND", 404, "Not found");
export const sessionCompleted = () => new AppError("SESSION_COMPLETED", 409, "This interview has ended");

function flattenSkills(skills = {}) {
  const all = [skills.languages, skills.frameworks, skills.databases, skills.cloud, skills.tools, skills.other];
  return [...new Set(all.flat().filter(Boolean))];
}

export function toSessionDto(row) {
  return {
    id: row.id,
    resumeId: row.resumeId,
    resumeName: row.profileSummary?.resumeName ?? row.profileSummary?.name ?? null,
    candidateName: row.profileSummary?.name ?? null,
    // Sent to speech-to-text as a vocabulary hint so tech words are transcribed correctly.
    skills: row.profileSummary?.topSkills ?? [],
    level: row.level,
    questionCount: row.questionCount,
    status: effectiveStatus(row),
    currentItem: row.currentItem,
    totalItems: row.plan.length,
    createdAt: row.createdAt,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    lastActivityAt: row.lastActivityAt,
  };
}

/** Scores and feedback stay hidden until the interview is completed (like a real interview). */
export function toTurnDto(turn, { includeEvaluation }) {
  const dto = {
    id: turn.id,
    idx: turn.idx,
    planItem: turn.planItem,
    category: turn.category,
    isFollowUp: turn.isFollowUp,
    questionText: turn.questionText,
    answerText: turn.answerText,
    answerMode: turn.answerMode,
    transcriptRaw: turn.transcriptRaw,
    askedAt: turn.askedAt,
    answeredAt: turn.answeredAt,
  };
  if (includeEvaluation) Object.assign(dto, { score: turn.score, feedback: turn.feedback, guardVerdict: turn.guardVerdict });
  return dto;
}

export async function getOwnedSession(userId, sessionId) {
  const [row] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
    .limit(1);
  if (!row) throw notFound();
  return row;
}

export function listTurns(sessionId) {
  return db.select().from(turns).where(eq(turns.sessionId, sessionId)).orderBy(asc(turns.idx));
}

/**
 * Session + its turns in one database round trip (a batch). The turns are fetched by session id
 * alongside the ownership-checked session and discarded if the session isn't the caller's.
 */
export async function getOwnedSessionWithTurns(userId, sessionId) {
  const [[row], history] = await db.batch([
    db
      .select()
      .from(sessions)
      .where(and(eq(sessions.id, sessionId), eq(sessions.userId, userId)))
      .limit(1),
    listTurns(sessionId),
  ]);
  if (!row) throw notFound();
  return { session: row, turns: history };
}

export async function createSession(userId, { resumeId, level, questionCount }, requestId) {
  const { profile, fileName } = await getResumeProfile(resumeId, userId, requestId);
  const profileSummary = {
    name: profile?.name ?? null,
    headline: profile?.headline ?? null,
    resumeName: fileName ?? null,
    topSkills: flattenSkills(profile?.skills).slice(0, 12),
    projectNames: (profile?.projects ?? []).map((p) => p.name).slice(0, 8),
  };

  const prompt = buildPlanPrompt({ level, questionCount, profile });
  const { data } = await chatJson({
    task: "interview_plan",
    models: [env.GROQ_MODEL_MAIN, env.GROQ_MODEL_FAST],
    messages: prompt.messages,
    jsonSchema: planJsonSchema,
    zodSchema: planZodSchema,
    temperature: 0.4,
    maxTokens: 2500,
  });
  const items = checkJsonOutput(data, { canary: prompt.canary }).ok ? data.items : [];
  const plan = normalizePlan(items, questionCount, profileSummary);

  const [row] = await db
    .insert(sessions)
    .values({ userId, resumeId, level, questionCount, plan, profileSummary })
    .returning();
  return toSessionDto(row);
}

export async function listSessions(userId, { limit, cursor }) {
  const where = cursor
    ? and(eq(sessions.userId, userId), lt(sessions.createdAt, new Date(cursor)))
    : eq(sessions.userId, userId);
  const rows = await db
    .select()
    .from(sessions)
    .where(where)
    .orderBy(desc(sessions.createdAt))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  return {
    items: page.map(toSessionDto),
    nextCursor: rows.length > limit ? page.at(-1).createdAt.toISOString() : null,
  };
}

export async function getSession(userId, sessionId) {
  const { session: row, turns: all } = await getOwnedSessionWithTurns(userId, sessionId);
  const includeEvaluation = row.status === "completed";
  return { session: toSessionDto(row), turns: all.map((t) => toTurnDto(t, { includeEvaluation })) };
}

/**
 * Marks the interview completed (idempotent) and asks report-service for the report.
 * Calling it again after a failed report simply retries the report.
 */
export async function endSession(userId, sessionId, requestId) {
  let { session: row, turns: all } = await getOwnedSessionWithTurns(userId, sessionId);
  if (row.status !== "completed") {
    [row] = await db
      .update(sessions)
      .set({ status: "completed", endedAt: new Date(), lastActivityAt: new Date() })
      .where(eq(sessions.id, row.id))
      .returning();
  }
  const { reportId } = await createReport(
    {
      session: {
        id: row.id,
        userId: row.userId,
        resumeId: row.resumeId,
        level: row.level,
        questionCount: row.questionCount,
        startedAt: row.startedAt,
        endedAt: row.endedAt,
      },
      profileSummary: row.profileSummary,
      turns: all.map((t) => ({
        idx: t.idx,
        planItem: t.planItem,
        category: t.category,
        isFollowUp: t.isFollowUp,
        topic: row.plan[t.planItem]?.topic ?? null,
        questionText: t.questionText,
        answerText: t.answerText,
        answerMode: t.answerMode,
        transcriptRaw: t.transcriptRaw,
        audioDurationSec: t.audioDurationSec,
        rubric: t.rubric,
        score: t.score,
        feedback: t.feedback,
        guardVerdict: t.guardVerdict,
        answeredAt: t.answeredAt,
      })),
    },
    userId,
    requestId,
  );
  return { reportId };
}
