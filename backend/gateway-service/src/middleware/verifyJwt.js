import { jwtVerify } from "jose";
import { env } from "../config/env.js";
import { AppError } from "../lib/AppError.js";
import { UUID_RE } from "../lib/validate.js";

const accessKey = new TextEncoder().encode(env.JWT_ACCESS_SECRET);

/** Verifies the Bearer access token and sets req.userId from its `sub` claim. */
export async function verifyJwt(req, _res, next) {
  const [scheme, token] = (req.get("authorization") ?? "").split(" ");
  if (scheme !== "Bearer" || !token) {
    return next(new AppError("TOKEN_INVALID", 401, "Please log in again"));
  }
  try {
    const { payload } = await jwtVerify(token, accessKey, {
      issuer: "mi-auth",
      audience: "mi-api",
      algorithms: ["HS256"],
    });
    if (typeof payload.sub !== "string" || !UUID_RE.test(payload.sub)) {
      return next(new AppError("TOKEN_INVALID", 401, "Please log in again"));
    }
    req.userId = payload.sub.toLowerCase();
    next();
  } catch (err) {
    if (err?.code === "ERR_JWT_EXPIRED") {
      return next(new AppError("TOKEN_EXPIRED", 401, "Session expired"));
    }
    next(new AppError("TOKEN_INVALID", 401, "Please log in again"));
  }
}
