import { toFile } from "groq-sdk";
import { env } from "../config/env.js";
import { aiBusy, getGroq, withRetry } from "../clients/groq.js";
import { AppError } from "../lib/AppError.js";
import { logger } from "../lib/logger.js";

/**
 * Transcribes an English answer with Whisper, falling back to the second model.
 * `hint` (skill names) is passed as Whisper's prompt so technical words are spelled right.
 */
export async function transcribe({ buffer, extension, mimetype, hint }) {
  for (const model of [env.GROQ_STT_MODEL, env.GROQ_STT_FALLBACK_MODEL]) {
    try {
      const started = Date.now();
      const result = await withRetry(async () =>
        getGroq().audio.transcriptions.create({
          file: await toFile(buffer, `answer.${extension}`, { type: mimetype }),
          model,
          language: "en",
          temperature: 0,
          response_format: "verbose_json",
          ...(hint ? { prompt: hint } : {}),
        }),
      );
      logger.info("stt_call", { model, ms: Date.now() - started, bytes: buffer.length });

      const text = String(result?.text ?? "").trim();
      if (!text) {
        throw new AppError("EMPTY_TRANSCRIPT", 422, "We couldn't hear an answer, please try again");
      }
      const durationSec = Number(result?.duration);
      return { text, durationSec: Number.isFinite(durationSec) ? Number(durationSec.toFixed(1)) : null };
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.warn("stt_call_failed", { model, status: err?.status, err: err?.message });
    }
  }
  throw aiBusy();
}
