import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4005),
  DATABASE_URL: z.string().startsWith("postgres"),
  GROQ_API_KEY: z.string().min(10),
  GROQ_MODEL_MAIN: z.string().default("openai/gpt-oss-120b"),
  GROQ_MODEL_FALLBACK: z.string().default("openai/gpt-oss-20b"),
  INTERNAL_API_KEY: z.string().min(32),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const keys = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
  throw new Error(`Invalid environment variables: ${keys}. See .env.example.`);
}

export const env = parsed.data;
