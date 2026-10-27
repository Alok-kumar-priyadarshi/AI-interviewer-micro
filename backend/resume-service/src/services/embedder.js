import os from "node:os";
import path from "node:path";
import { env } from "../config/env.js";
import { EMBEDDING_DIMENSIONS } from "../db/schema.js";
import { logger } from "../lib/logger.js";

const HF_BATCH = 32;

function normalize(vector) {
  const norm = Math.sqrt(vector.reduce((sum, x) => sum + x * x, 0)) || 1;
  return vector.map((x) => x / norm);
}

function assertVectors(vectors, count) {
  const ok =
    Array.isArray(vectors) &&
    vectors.length === count &&
    vectors.every((v) => Array.isArray(v) && v.length === EMBEDDING_DIMENSIONS && v.every(Number.isFinite));
  if (!ok) throw new Error("embedding provider returned an unexpected shape");
  return vectors;
}

let localExtractor;

async function embedLocal(texts) {
  localExtractor ??= (async () => {
    // Built from parts so Vercel's file tracer does not bundle this large, dev-only package.
    const packageName = ["@huggingface", "transformers"].join("/");
    const { pipeline, env: hfEnv } = await import(packageName);
    hfEnv.cacheDir = path.join(os.tmpdir(), "hf-cache");
    return pipeline("feature-extraction", env.EMBEDDING_MODEL);
  })();
  const extractor = await localExtractor;
  const output = await extractor(texts, { pooling: "mean", normalize: true });
  return output.tolist();
}

async function embedHf(texts) {
  const vectors = [];
  for (let i = 0; i < texts.length; i += HF_BATCH) {
    const batch = texts.slice(i, i + HF_BATCH);
    const res = await fetch(env.HF_EMBEDDING_URL, {
      method: "POST",
      headers: { authorization: `Bearer ${env.HF_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({ inputs: batch, normalize: true, truncate: true }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`Hugging Face embeddings failed with ${res.status}`);
    vectors.push(...(await res.json()));
  }
  return vectors;
}

/**
 * Embeds texts into normalized 384-d vectors. Returns `null` entries (never throws) when the
 * provider is disabled or failing; retrieval then falls back to full-text search.
 */
export async function embedTexts(texts) {
  if (!texts.length) return [];
  if (env.EMBEDDING_PROVIDER === "none") return texts.map(() => null);
  try {
    const raw = env.EMBEDDING_PROVIDER === "local" ? await embedLocal(texts) : await embedHf(texts);
    return assertVectors(raw, texts.length).map(normalize);
  } catch (err) {
    logger.warn("embedding_failed", { provider: env.EMBEDDING_PROVIDER, err: err?.message });
    return texts.map(() => null);
  }
}
