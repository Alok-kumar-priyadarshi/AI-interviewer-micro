import Groq from "groq-sdk";
import { env } from "../config/env.js";
import { AppError } from "../lib/AppError.js";
import { logger } from "../lib/logger.js";

let client;

/** Lazily created so tests can mock this module without a real key. */
export function getGroq() {
  client ??= new Groq({ apiKey: env.GROQ_API_KEY, maxRetries: 0, timeout: 30_000 });
  return client;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isRetryable(err) {
  const status = err?.status;
  return status === 429 || (typeof status === "number" && status >= 500) || status === undefined;
}

function retryDelayMs(err, attempt) {
  const header = err?.headers?.get?.("retry-after") ?? err?.headers?.["retry-after"];
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds > 0 && seconds <= 10) return seconds * 1000;
  return attempt === 0 ? 1000 : 3000;
}

/** Runs `fn` with up to 2 retries on 429 / 5xx / network errors. */
export async function withRetry(fn) {
  let lastErr;
  for (let attempt = 0; attempt <= 2; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || attempt === 2) break;
      await sleep(retryDelayMs(err, attempt));
    }
  }
  throw lastErr;
}

export function aiBusy() {
  return new AppError("AI_BUSY", 503, "The AI is busy right now. Please try again in a minute");
}

const isGptOss = (model) => model.startsWith("openai/gpt-oss");

function buildParams({ model, messages, temperature, maxTokens, reasoningEffort, jsonSchema, stream }) {
  const params = { model, messages, temperature, max_completion_tokens: maxTokens };
  if (isGptOss(model)) {
    params.reasoning_effort = reasoningEffort;
    params.include_reasoning = false;
  }
  if (jsonSchema) {
    params.response_format = {
      type: "json_schema",
      json_schema: { name: jsonSchema.name, strict: true, schema: jsonSchema.schema },
    };
  }
  if (stream) params.stream = true;
  return params;
}

function logUsage(task, model, started, usage) {
  logger.info("llm_call", {
    task,
    model,
    promptTokens: usage?.prompt_tokens,
    completionTokens: usage?.completion_tokens,
    ms: Date.now() - started,
  });
}

/**
 * Plain chat completion with retry, then fallback through `models` in order.
 * Returns { content, model }. Throws AI_BUSY when every model fails.
 */
export async function chatText({
  task,
  models,
  messages,
  temperature = 0.2,
  maxTokens = 800,
  reasoningEffort = "low",
}) {
  for (const model of models.filter(Boolean)) {
    try {
      const started = Date.now();
      const res = await withRetry(() =>
        getGroq().chat.completions.create(
          buildParams({ model, messages, temperature, maxTokens, reasoningEffort }),
        ),
      );
      logUsage(task, model, started, res.usage);
      return { content: res.choices?.[0]?.message?.content ?? "", model };
    } catch (err) {
      logger.warn("llm_call_failed", { task, model, status: err?.status, err: err?.message });
    }
  }
  throw aiBusy();
}

/**
 * JSON chat completion using strict structured outputs, validated with a Zod schema.
 * Each model gets two attempts (to recover from a malformed reply) before falling back.
 * Returns { data, model }.
 */
export async function chatJson({
  task,
  models,
  messages,
  jsonSchema,
  zodSchema,
  temperature = 0,
  maxTokens = 1200,
  reasoningEffort = "low",
}) {
  for (const model of models.filter(Boolean)) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const started = Date.now();
        const res = await withRetry(() =>
          getGroq().chat.completions.create(
            buildParams({ model, messages, temperature, maxTokens, reasoningEffort, jsonSchema }),
          ),
        );
        logUsage(task, model, started, res.usage);
        const raw = res.choices?.[0]?.message?.content ?? "";
        const parsed = zodSchema.safeParse(JSON.parse(raw));
        if (parsed.success) return { data: parsed.data, model };
        logger.warn("llm_json_invalid", { task, model, issues: parsed.error.issues.length });
      } catch (err) {
        logger.warn("llm_call_failed", { task, model, status: err?.status, err: err?.message });
        if (err?.status !== undefined && !(err instanceof SyntaxError)) break; // API error: next model
      }
    }
  }
  throw aiBusy();
}

/**
 * Starts a streamed chat completion. Resolves once the stream is open (errors before the
 * first token trigger retry/fallback), so callers can still answer with a normal HTTP error.
 * Returns { stream, model } where stream yields text deltas.
 */
export async function chatStream({
  task,
  models,
  messages,
  temperature = 0.7,
  maxTokens = 400,
  reasoningEffort = "low",
}) {
  for (const model of models.filter(Boolean)) {
    try {
      const started = Date.now();
      const raw = await withRetry(() =>
        getGroq().chat.completions.create(
          buildParams({ model, messages, temperature, maxTokens, reasoningEffort, stream: true }),
        ),
      );
      async function* deltas() {
        let usage;
        for await (const chunk of raw) {
          usage = chunk.x_groq?.usage ?? chunk.usage ?? usage;
          const text = chunk.choices?.[0]?.delta?.content;
          if (text) yield text;
        }
        logUsage(task, model, started, usage);
      }
      return { stream: deltas(), model };
    } catch (err) {
      logger.warn("llm_stream_failed", { task, model, status: err?.status, err: err?.message });
    }
  }
  throw aiBusy();
}
