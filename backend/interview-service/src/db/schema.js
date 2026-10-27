import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  jsonb,
  numeric,
  pgSchema,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const interviewSchema = pgSchema("interview");

export const levelEnum = interviewSchema.enum("level", ["low", "medium", "high"]);
export const sessionStatusEnum = interviewSchema.enum("session_status", [
  "created",
  "in_progress",
  "completed",
  "abandoned",
]);
export const categoryEnum = interviewSchema.enum("question_category", [
  "intro",
  "project",
  "technical",
  "behavioral",
]);
export const answerModeEnum = interviewSchema.enum("answer_mode", ["text", "voice"]);
export const guardVerdictEnum = interviewSchema.enum("guard_verdict", ["allow", "sanitize", "block"]);

const tz = (name) => timestamp(name, { withTimezone: true });

export const sessions = interviewSchema.table(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    resumeId: uuid("resume_id").notNull(),
    level: levelEnum("level").notNull(),
    questionCount: smallint("question_count").notNull(),
    status: sessionStatusEnum("status").notNull().default("created"),
    plan: jsonb("plan").notNull(),
    currentItem: smallint("current_item").notNull().default(0),
    profileSummary: jsonb("profile_summary").notNull(),
    lastActivityAt: tz("last_activity_at").notNull().defaultNow(),
    startedAt: tz("started_at"),
    endedAt: tz("ended_at"),
    createdAt: tz("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("sessions_user_created_idx").on(t.userId, t.createdAt.desc()),
    check("sessions_question_count_check", sql`${t.questionCount} in (5, 8, 12)`),
  ],
);

export const turns = interviewSchema.table(
  "turns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    idx: smallint("idx").notNull(),
    planItem: smallint("plan_item").notNull(),
    category: categoryEnum("category").notNull(),
    isFollowUp: boolean("is_follow_up").notNull().default(false),
    parentTurnId: uuid("parent_turn_id"),
    questionText: text("question_text").notNull(),
    sourceChunkIds: uuid("source_chunk_ids").array().notNull().default(sql`'{}'::uuid[]`),
    answerText: text("answer_text"),
    answerMode: answerModeEnum("answer_mode"),
    transcriptRaw: text("transcript_raw"),
    audioDurationSec: numeric("audio_duration_sec", { precision: 6, scale: 1, mode: "number" }),
    rubric: jsonb("rubric"),
    score: numeric("score", { precision: 3, scale: 1, mode: "number" }),
    feedback: jsonb("feedback"),
    guardVerdict: guardVerdictEnum("guard_verdict"),
    guardFlags: jsonb("guard_flags").notNull().default([]),
    askedAt: tz("asked_at").notNull().defaultNow(),
    answeredAt: tz("answered_at"),
  },
  (t) => [uniqueIndex("turns_session_idx_uq").on(t.sessionId, t.idx)],
);
