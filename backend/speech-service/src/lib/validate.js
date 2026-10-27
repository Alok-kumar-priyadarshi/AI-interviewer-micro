import { AppError } from "./AppError.js";

/** Parses `data` with a Zod schema or throws a 400 VALIDATION_ERROR listing each issue. */
export function parseOrThrow(schema, data) {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  const details = result.error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
  throw new AppError("VALIDATION_ERROR", 400, "Please check the highlighted fields", details);
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
