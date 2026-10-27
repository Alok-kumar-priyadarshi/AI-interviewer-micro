CREATE SCHEMA IF NOT EXISTS "resume";
--> statement-breakpoint
CREATE TABLE "resume"."resume_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"resume_id" uuid NOT NULL,
	"section" varchar(20) NOT NULL,
	"title" varchar(200),
	"content" text NOT NULL,
	"token_count" integer NOT NULL,
	"embedding" vector(384),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resume"."resumes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"drive_file_id" varchar(128) NOT NULL,
	"source_url" text NOT NULL,
	"file_name" varchar(255),
	"mime_type" varchar(100) NOT NULL,
	"size_bytes" integer NOT NULL,
	"raw_text" text NOT NULL,
	"profile" jsonb NOT NULL,
	"resume_confidence" numeric(3, 2) NOT NULL,
	"guard_flags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "resume"."resume_chunks" ADD CONSTRAINT "resume_chunks_resume_id_resumes_id_fk" FOREIGN KEY ("resume_id") REFERENCES "resume"."resumes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "resume_chunks_resume_idx" ON "resume"."resume_chunks" USING btree ("resume_id");--> statement-breakpoint
CREATE INDEX "resume_chunks_embedding_idx" ON "resume"."resume_chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "resumes_user_file_uq" ON "resume"."resumes" USING btree ("user_id","drive_file_id");--> statement-breakpoint
CREATE INDEX "resumes_user_created_idx" ON "resume"."resumes" USING btree ("user_id","created_at" DESC NULLS LAST);