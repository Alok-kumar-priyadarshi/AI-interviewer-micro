import { z } from "zod";

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(4002),
    DATABASE_URL: z.string().startsWith("postgres"),
    GROQ_API_KEY: z.string().min(10),
    GROQ_MODEL_MAIN: z.string().default("openai/gpt-oss-120b"),
    GROQ_MODEL_FAST: z.string().default("openai/gpt-oss-20b"),
    // local = transformers.js on this machine (dev only), hf = Hugging Face Inference (production),
    // none = no embeddings; retrieval then uses Postgres full-text search only.
    EMBEDDING_PROVIDER: z.enum(["local", "hf", "none"]).default("hf"),
    EMBEDDING_MODEL: z.string().default("Xenova/all-MiniLM-L6-v2"),
    HF_TOKEN: z.string().optional(),
    HF_EMBEDDING_URL: z
      .url()
      .default(
        "https://router.huggingface.co/hf-inference/models/sentence-transformers/all-MiniLM-L6-v2/pipeline/feature-extraction",
      ),
    MAX_RESUME_MB: z.coerce.number().positive().max(10).default(5),
    DRIVE_FETCH_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
    GUARD_SERVICE_URL: z.url({ protocol: /^https?$/ }),
    INTERNAL_API_KEY: z.string().min(32),
  })
  .refine((value) => value.EMBEDDING_PROVIDER !== "hf" || Boolean(value.HF_TOKEN), {
    message: "HF_TOKEN is required when EMBEDDING_PROVIDER=hf",
    path: ["HF_TOKEN"],
  });

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const keys = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
  throw new Error(`Invalid environment variables: ${keys}. See .env.example.`);
}

export const env = parsed.data;
