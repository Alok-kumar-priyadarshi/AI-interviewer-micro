import { env } from "../config/env.js";
import { localVerdict } from "../lib/injectionRules.js";
import { logger } from "../lib/logger.js";
import { callService } from "./internalHttp.js";

/** Resume profile (404 when the resume is not the caller's). */
export function getResumeProfile(resumeId, userId, requestId) {
  return callService({
    baseUrl: env.RESUME_SERVICE_URL,
    path: `/internal/resumes/${resumeId}/profile`,
    userId,
    requestId,
  });
}

/** RAG chunks. Never fails the interview: no chunks is a usable answer. */
export async function searchResume(resumeId, userId, query, k, requestId) {
  try {
    const { chunks } = await callService({
      baseUrl: env.RESUME_SERVICE_URL,
      path: `/internal/resumes/${resumeId}/search`,
      method: "POST",
      body: { query: query.slice(0, 500), k },
      userId,
      requestId,
    });
    return chunks ?? [];
  } catch (err) {
    logger.warn("resume_search_failed", { requestId, code: err?.code });
    return [];
  }
}

/** Guard verdict; if guard-service is unreachable, local rules decide (never "allow"). */
export async function guardCheck(text, requestId) {
  try {
    return await callService({
      baseUrl: env.GUARD_SERVICE_URL,
      path: "/internal/guard/check",
      method: "POST",
      body: { text, source: "answer" },
      requestId,
      timeoutMs: 10_000,
    });
  } catch (err) {
    logger.warn("guard_unavailable", { requestId, code: err?.code });
    return localVerdict(text);
  }
}

export function createReport(payload, userId, requestId) {
  return callService({
    baseUrl: env.REPORT_SERVICE_URL,
    path: "/internal/reports",
    method: "POST",
    body: payload,
    userId,
    requestId,
    timeoutMs: 50_000,
  });
}
