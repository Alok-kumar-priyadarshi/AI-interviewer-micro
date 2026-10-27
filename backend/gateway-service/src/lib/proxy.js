import { env } from "../config/env.js";
import { AppError } from "./AppError.js";
import { logger } from "./logger.js";

const FORWARDED_REQUEST_HEADERS = ["content-type", "accept", "user-agent", "x-forwarded-for"];

// Hop-by-hop and length/encoding headers are recomputed by Node; set-cookie is handled explicitly.
const SKIPPED_RESPONSE_HEADERS = new Set([
  "connection",
  "keep-alive",
  "transfer-encoding",
  "upgrade",
  "te",
  "trailer",
  "content-length",
  "content-encoding",
  "set-cookie",
]);

const maxBodyBytes = Math.floor(env.MAX_BODY_MB * 1024 * 1024);

// Covers a service restart (node --watch, deploys): about 2.5 s in total.
const REFUSED_RETRY_DELAYS_MS = [250, 750, 1500];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isConnectionRefused(err) {
  const code = err?.cause?.code ?? err?.code;
  return code === "ECONNREFUSED" || err?.cause?.errors?.some?.((e) => e.code === "ECONNREFUSED");
}

/** Buffers the request body (bounded) so upstream gets a normal Content-Length request. */
async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBodyBytes) throw new AppError("PAYLOAD_TOO_LARGE", 413, "Request is too large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Forwards the request to `target`, keeping the original path and query, adding the
 * internal headers, and streaming the upstream response back unchanged.
 */
export async function proxyRequest(req, res, { target, userId, forwardCookies }) {
  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = req.get(name);
    if (value) headers.set(name, value);
  }
  headers.set("x-request-id", req.id);
  headers.set("x-internal-key", env.INTERNAL_API_KEY);
  if (userId) headers.set("x-user-id", userId);
  if (forwardCookies && req.get("cookie")) headers.set("cookie", req.get("cookie"));

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const body = hasBody ? await readBody(req) : undefined;

  const signal = AbortSignal.timeout(env.UPSTREAM_TIMEOUT_MS);
  let upstream;
  for (let attempt = 0; ; attempt += 1) {
    try {
      upstream = await fetch(new URL(req.originalUrl, target), {
        method: req.method,
        headers,
        body,
        redirect: "manual",
        signal,
      });
      break;
    } catch (err) {
      // A refused connection means the service is (re)starting and never saw the request, so
      // retrying is safe for every method. Anything else is reported straight away.
      if (isConnectionRefused(err) && attempt < REFUSED_RETRY_DELAYS_MS.length) {
        await sleep(REFUSED_RETRY_DELAYS_MS[attempt]);
        continue;
      }
      logger.warn("upstream_failed", { requestId: req.id, target, attempts: attempt + 1, err: err?.message });
      if (err?.name === "TimeoutError") {
        throw new AppError("UPSTREAM_TIMEOUT", 504, "The request took too long, please retry");
      }
      throw new AppError("UPSTREAM_UNAVAILABLE", 502, "Service unavailable, please retry");
    }
  }

  res.status(upstream.status);
  for (const [name, value] of upstream.headers) {
    if (!SKIPPED_RESPONSE_HEADERS.has(name)) res.setHeader(name, value);
  }
  if (forwardCookies) {
    const cookies = upstream.headers.getSetCookie();
    if (cookies.length) res.setHeader("set-cookie", cookies);
  }

  if (!upstream.body) return res.end();
  try {
    for await (const chunk of upstream.body) res.write(chunk);
  } catch (err) {
    logger.warn("upstream_stream_broken", { requestId: req.id, err: err?.message });
  }
  res.end();
}
