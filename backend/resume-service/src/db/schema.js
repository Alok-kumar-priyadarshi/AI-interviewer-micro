import {
  index,
  integer,
  jsonb,
  numeric,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  vector,
} from "drizzle-orm/pg-core";

export const resumeSchema = pgSchema("resume");

export const EMBEDDING_DIMENSIONS = 384;

export const resumes = resumeSchema.table(
  "resumes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull(),
    driveFileId: varchar("drive_file_id", { length: 128 }).notNull(),
    sourceUrl: text("source_url").notNull(),
    fileName: varchar("file_name", { length: 255 }),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    rawText: text("raw_text").notNull(),
    profile: jsonb("profile").notNull(),
    resumeConfidence: numeric("resume_confidence", { precision: 3, scale: 2, mode: "number" }).notNull(),
    guardFlags: jsonb("guard_flags").notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("resumes_user_file_uq").on(t.userId, t.driveFileId),
    index("resumes_user_created_idx").on(t.userId, t.createdAt.desc()),
  ],
);

export const resumeChunks = resumeSchema.table(
  "resume_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    resumeId: uuid("resume_id")
      .notNull()
      .references(() => resumes.id, { onDelete: "cascade" }),
    section: varchar("section", { length: 20 }).notNull(),
    title: varchar("title", { length: 200 }),
    content: text("content").notNull(),
    tokenCount: integer("token_count").notNull(),
    // Nullable: if the embedding provider is down or disabled, retrieval falls back to full-text.
    embedding: vector("embedding", { dimensions: EMBEDDING_DIMENSIONS }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("resume_chunks_resume_idx").on(t.resumeId),
    index("resume_chunks_embedding_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
  ],
);
