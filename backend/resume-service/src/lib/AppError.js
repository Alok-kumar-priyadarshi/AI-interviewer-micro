/**
 * An expected, user-facing error. The error handler turns it into
 * `{ error: { code, message, details?, requestId } }` with `status`.
 */
export class AppError extends Error {
  constructor(code, status, message, details) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    if (details !== undefined) this.details = details;
  }
}

export function isAppError(err) {
  return err instanceof AppError;
}
