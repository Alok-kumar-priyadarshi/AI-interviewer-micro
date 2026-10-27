import {
  boolean,
  index,
  jsonb,
  numeric,
  pgSchema,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const reportSchema = pgSchema("report");

// Own copies of the interview enums: schemas never depend on each other.
export const levelEnum = reportSchema.enum("level", ["low", "medium", "high"]);
export const categoryEnum = reportSchema.enum("question_category", ["intro", "project", "technical", "behavioral"]);
export const answerModeEnum = reportSchema.enum("answer_mode", ["text", "voice"]);
export const guardVerdictEnum = reportSchema.enum("guard_verdict", ["allow", "sanitize", "block"]);

const tz = (name) => timestamp(name, { withTimezone: true });

export const reports = reportSchema.table(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id").notNull().unique(),
    userId: uuid("user_id").notNull(),
    resumeId: uuid("resume_id").notNull(),
    level: levelEnum("level").notNull(),
    questionsAnswered: smallint("questions_answered").notNull(),
    overallScore: numeric("overall_score", { precision: 4, scale: 1, mode: "number" }),
    categoryScores: jsonb("category_scores").notNull(),
    summary: text("summary").notNull(),
    strengths: jsonb("strengths").notNull(),
    improvements: jsonb("improvements").notNull(),
    recommendedTopics: jsonb("recommended_topics").notNull(),
    integrityNotes: jsonb("integrity_notes").notNull().default([]),
    comparison: jsonb("comparison").notNull(),
    profileSummary: jsonb("profile_summary").notNull(),
    modelUsed: varchar("model_used", { length: 100 }).notNull(),
    startedAt: tz("started_at"),
    endedAt: tz("ended_at"),
    createdAt: tz("created_at").notNull().defaultNow(),
  },
  (t) => [index("reports_user_created_idx").on(t.userId, t.createdAt.desc())],
);

export const reportItems = reportSchema.table(
  "report_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reportId: uuid("report_id")
      .notNull()
      .references(() => reports.id, { onDelete: "cascade" }),
    idx: smallint("idx").notNull(),
    category: categoryEnum("category").notNull(),
    topic: varchar("topic", { length: 120 }),
    isFollowUp: boolean("is_follow_up").notNull(),
    question: text("question").notNull(),
    answerText: text("answer_text"),
    answerMode: answerModeEnum("answer_mode"),
    transcriptRaw: text("transcript_raw"),
    audioDurationSec: numeric("audio_duration_sec", { precision: 6, scale: 1, mode: "number" }),
    rubric: jsonb("rubric"),
    score: numeric("score", { precision: 3, scale: 1, mode: "number" }),
    strengths: jsonb("strengths").notNull().default([]),
    gaps: jsonb("gaps").notNull().default([]),
    idealAnswerHints: jsonb("ideal_answer_hints").notNull().default([]),
    guardVerdict: guardVerdictEnum("guard_verdict"),
  },
  (t) => [uniqueIndex("report_items_report_idx_uq").on(t.reportId, t.idx)],
);
