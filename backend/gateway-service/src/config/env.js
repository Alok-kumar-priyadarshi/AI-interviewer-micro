import { z } from "zod";

const url = z.url({ protocol: /^https?$/ });

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  AUTH_SERVICE_URL: url,
  RESUME_SERVICE_URL: url,
  INTERVIEW_SERVICE_URL: url,
  SPEECH_SERVICE_URL: url,
  REPORT_SERVICE_URL: url,
  JWT_ACCESS_SECRET: z.string().min(32),
  INTERNAL_API_KEY: z.string().min(32),
  UPSTREAM_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
  MAX_BODY_MB: z.coerce.number().positive().default(4.5),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const keys = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
  throw new Error(`Invalid environment variables: ${keys}. See .env.example.`);
}

export const env = parsed.data;
