import { env } from "../config/env.js";
import { localVerdict } from "../lib/injectionRules.js";
import { logger } from "../lib/logger.js";
import { callService } from "./internalHttp.js";

/** Asks guard-service for a verdict; if it is unreachable, uses the local rules (never "allow"). */
export async function guardCheck(text, source, requestId) {
  try {
    return await callService({
      baseUrl: env.GUARD_SERVICE_URL,
      path: "/internal/guard/check",
      method: "POST",
      body: { text, source },
      requestId,
      timeoutMs: 15_000,
    });
  } catch (err) {
    logger.warn("guard_unavailable", { requestId, code: err?.code });
    return localVerdict(text);
  }
}
