import { z } from "zod";

const url = z.url({ protocol: /^https?$/ });

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4003),
  DATABASE_URL: z.string().startsWith("postgres"),
  GROQ_API_KEY: z.string().min(10),
  GROQ_MODEL_MAIN: z.string().default("openai/gpt-oss-120b"),
  GROQ_MODEL_FAST: z.string().default("openai/gpt-oss-20b"),
  RESUME_SERVICE_URL: url,
  GUARD_SERVICE_URL: url,
  REPORT_SERVICE_URL: url,
  RAG_TOP_K: z.coerce.number().int().min(1).max(5).default(3),
  INTERNAL_API_KEY: z.string().min(32),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const keys = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
  throw new Error(`Invalid environment variables: ${keys}. See .env.example.`);
}

export const env = parsed.data;
