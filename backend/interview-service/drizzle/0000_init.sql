CREATE SCHEMA IF NOT EXISTS "interview";
--> statement-breakpoint
CREATE TYPE "interview"."answer_mode" AS ENUM('text', 'voice');--> statement-breakpoint
CREATE TYPE "interview"."question_category" AS ENUM('intro', 'project', 'technical', 'behavioral');--> statement-breakpoint
CREATE TYPE "interview"."guard_verdict" AS ENUM('allow', 'sanitize', 'block');--> statement-breakpoint
CREATE TYPE "interview"."level" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "interview"."session_status" AS ENUM('created', 'in_progress', 'completed', 'abandoned');--> statement-breakpoint
CREATE TABLE "interview"."sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"resume_id" uuid NOT NULL,
	"level" "interview"."level" NOT NULL,
	"question_count" smallint NOT NULL,
	"status" "interview"."session_status" DEFAULT 'created' NOT NULL,
	"plan" jsonb NOT NULL,
	"current_item" smallint DEFAULT 0 NOT NULL,
	"profile_summary" jsonb NOT NULL,
	"last_activity_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_question_count_check" CHECK ("interview"."sessions"."question_count" in (5, 8, 12))
);
--> statement-breakpoint
CREATE TABLE "interview"."turns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"idx" smallint NOT NULL,
	"plan_item" smallint NOT NULL,
	"category" "interview"."question_category" NOT NULL,
	"is_follow_up" boolean DEFAULT false NOT NULL,
	"parent_turn_id" uuid,
	"question_text" text NOT NULL,
	"source_chunk_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"answer_text" text,
	"answer_mode" "interview"."answer_mode",
	"transcript_raw" text,
	"audio_duration_sec" numeric(6, 1),
	"rubric" jsonb,
	"score" numeric(3, 1),
	"feedback" jsonb,
	"guard_verdict" "interview"."guard_verdict",
	"guard_flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"asked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"answered_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "interview"."turns" ADD CONSTRAINT "turns_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "interview"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sessions_user_created_idx" ON "interview"."sessions" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "turns_session_idx_uq" ON "interview"."turns" USING btree ("session_id","idx");