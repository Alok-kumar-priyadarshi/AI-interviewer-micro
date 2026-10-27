import { timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";
import { AppError } from "../lib/AppError.js";
import { UUID_RE } from "../lib/validate.js";

const expectedKey = Buffer.from(env.INTERNAL_API_KEY);

/** Rejects any request that does not carry the shared internal key. */
export function internalAuth(req, _res, next) {
  const given = Buffer.from(req.get("x-internal-key") ?? "");
  if (given.length !== expectedKey.length || !timingSafeEqual(given, expectedKey)) {
    return next(new AppError("UNAUTHORIZED_INTERNAL", 401, "Unauthorized"));
  }
  next();
}

/** Requires the x-user-id the gateway sets after verifying the JWT. Use after internalAuth. */
export function requireUser(req, _res, next) {
  const userId = req.get("x-user-id");
  if (!userId || !UUID_RE.test(userId)) {
    return next(new AppError("UNAUTHORIZED_INTERNAL", 401, "Missing user"));
  }
  req.userId = userId.toLowerCase();
  next();
}
