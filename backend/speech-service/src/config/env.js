import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4004),
  GROQ_API_KEY: z.string().min(10),
  GROQ_STT_MODEL: z.string().default("whisper-large-v3-turbo"),
  GROQ_STT_FALLBACK_MODEL: z.string().default("whisper-large-v3"),
  MAX_AUDIO_MB: z.coerce.number().positive().max(4.5).default(4),
  INTERNAL_API_KEY: z.string().min(32),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const keys = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
  throw new Error(`Invalid environment variables: ${keys}. See .env.example.`);
}

export const env = parsed.data;
