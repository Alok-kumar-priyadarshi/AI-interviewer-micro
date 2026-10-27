import { env } from "../config/env.js";
import { AppError } from "../lib/AppError.js";

// Covers a service restart (node --watch, deploys): about 2.5 s in total.
const REFUSED_RETRY_DELAYS_MS = [250, 750, 1500];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isConnectionRefused(err) {
  const code = err?.cause?.code ?? err?.code;
  return code === "ECONNREFUSED" || err?.cause?.errors?.some?.((e) => e.code === "ECONNREFUSED");
}

/**
 * Calls another backend service with the internal key, request id and user id attached.
 * Known error codes from the callee are passed through; anything else becomes UPSTREAM_*.
 */
export async function callService({
  baseUrl,
  path,
  method = "GET",
  body,
  userId,
  requestId,
  timeoutMs = 10_000,
}) {
  const headers = { "x-internal-key": env.INTERNAL_API_KEY, accept: "application/json" };
  if (requestId) headers["x-request-id"] = requestId;
  if (userId) headers["x-user-id"] = userId;
  if (body !== undefined) headers["content-type"] = "application/json";

  const signal = AbortSignal.timeout(timeoutMs);
  let res;
  for (let attempt = 0; ; attempt += 1) {
    try {
      res = await fetch(new URL(path, baseUrl), {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
      });
      break;
    } catch (err) {
      // Refused = the other service is (re)starting and never saw the request: safe to retry.
      if (isConnectionRefused(err) && attempt < REFUSED_RETRY_DELAYS_MS.length) {
        await sleep(REFUSED_RETRY_DELAYS_MS[attempt]);
        continue;
      }
      if (err?.name === "TimeoutError") {
        throw new AppError("UPSTREAM_TIMEOUT", 504, "The request took too long, please retry");
      }
      throw new AppError("UPSTREAM_UNAVAILABLE", 502, "Service unavailable, please retry");
    }
  }

  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (res.ok) return data;

  const error = data?.error;
  if (error?.code && error.code !== "UNAUTHORIZED_INTERNAL") {
    throw new AppError(error.code, res.status, error.message, error.details);
  }
  throw new AppError("UPSTREAM_UNAVAILABLE", 502, "Service unavailable, please retry");
}
