import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4006),
  GROQ_API_KEY: z.string().min(10),
  GROQ_PROMPT_GUARD_MODEL: z.string().default("meta-llama/llama-prompt-guard-2-86m"),
  GROQ_GUARD_FALLBACK_MODEL: z.string().default("openai/gpt-oss-20b"),
  GUARD_BLOCK_THRESHOLD: z.coerce.number().min(0).max(1).default(0.85),
  GUARD_SANITIZE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.5),
  INTERNAL_API_KEY: z.string().min(32),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const keys = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
  throw new Error(`Invalid environment variables: ${keys}. See .env.example.`);
}

export const env = parsed.data;
