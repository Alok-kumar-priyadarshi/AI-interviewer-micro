CREATE SCHEMA IF NOT EXISTS "report";
--> statement-breakpoint
CREATE TYPE "report"."answer_mode" AS ENUM('text', 'voice');--> statement-breakpoint
CREATE TYPE "report"."question_category" AS ENUM('intro', 'project', 'technical', 'behavioral');--> statement-breakpoint
CREATE TYPE "report"."guard_verdict" AS ENUM('allow', 'sanitize', 'block');--> statement-breakpoint
CREATE TYPE "report"."level" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TABLE "report"."report_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"idx" smallint NOT NULL,
	"category" "report"."question_category" NOT NULL,
	"topic" varchar(120),
	"is_follow_up" boolean NOT NULL,
	"question" text NOT NULL,
	"answer_text" text,
	"answer_mode" "report"."answer_mode",
	"transcript_raw" text,
	"audio_duration_sec" numeric(6, 1),
	"rubric" jsonb,
	"score" numeric(3, 1),
	"strengths" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"gaps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ideal_answer_hints" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"guard_verdict" "report"."guard_verdict"
);
--> statement-breakpoint
CREATE TABLE "report"."reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"resume_id" uuid NOT NULL,
	"level" "report"."level" NOT NULL,
	"questions_answered" smallint NOT NULL,
	"overall_score" numeric(4, 1),
	"category_scores" jsonb NOT NULL,
	"summary" text NOT NULL,
	"strengths" jsonb NOT NULL,
	"improvements" jsonb NOT NULL,
	"recommended_topics" jsonb NOT NULL,
	"integrity_notes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"comparison" jsonb NOT NULL,
	"profile_summary" jsonb NOT NULL,
	"model_used" varchar(100) NOT NULL,
	"started_at" timestamp with time zone,
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reports_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
ALTER TABLE "report"."report_items" ADD CONSTRAINT "report_items_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "report"."reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "report_items_report_idx_uq" ON "report"."report_items" USING btree ("report_id","idx");--> statement-breakpoint
CREATE INDEX "reports_user_created_idx" ON "report"."reports" USING btree ("user_id","created_at" DESC NULLS LAST);