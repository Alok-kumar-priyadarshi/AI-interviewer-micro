import { AppError } from "../lib/AppError.js";
import { logger } from "../lib/logger.js";

export function notFound(_req, _res, next) {
  next(new AppError("NOT_FOUND", 404, "Not found"));
}

// Express recognises error handlers by their four parameters, so `_next` must stay.
export function errorHandler(err, req, res, _next) {
  const requestId = req.id;

  if (res.headersSent) {
    logger.error("error_after_headers_sent", { requestId, err: err?.message });
    return res.end();
  }

  let appError = err instanceof AppError ? err : null;
  if (!appError && err?.type === "entity.too.large") {
    appError = new AppError("PAYLOAD_TOO_LARGE", 413, "Request is too large");
  }
  if (!appError && err?.type === "entity.parse.failed") {
    appError = new AppError("VALIDATION_ERROR", 400, "Malformed JSON body");
  }

  if (appError) {
    if (appError.status >= 500) {
      logger.warn("request_failed", { requestId, code: appError.code, status: appError.status });
    }
    const body = { code: appError.code, message: appError.message, requestId };
    if (appError.details !== undefined) body.details = appError.details;
    return res.status(appError.status).json({ error: body });
  }

  logger.error("unhandled_error", { requestId, err: err?.message, stack: err?.stack });
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Something went wrong", requestId },
  });
}
