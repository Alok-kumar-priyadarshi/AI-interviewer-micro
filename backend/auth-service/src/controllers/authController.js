import { env } from "../config/env.js";
import { parseOrThrow } from "../lib/validate.js";
import * as authService from "../services/authService.js";
import * as tokenService from "../services/tokenService.js";
import { loginSchema, signupSchema } from "../validators/authSchemas.js";

const COOKIE_NAME = "mi_rt";
const cookieOptions = (expires) => ({
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "strict",
  path: "/api/auth",
  expires,
});

function requestMeta(req) {
  const forwarded = req.get("x-forwarded-for");
  return {
    ip: forwarded ? forwarded.split(",")[0].trim() : req.socket.remoteAddress,
    userAgent: req.get("user-agent"),
  };
}

function sendSession(res, status, { user, accessToken, refreshToken, refreshExpiresAt }) {
  res.cookie(COOKIE_NAME, refreshToken, cookieOptions(refreshExpiresAt));
  res.set("cache-control", "no-store");
  res.status(status).json(user ? { user, accessToken } : { accessToken });
}

export async function signup(req, res) {
  const input = parseOrThrow(signupSchema, req.body);
  sendSession(res, 201, await authService.signup(input, requestMeta(req)));
}

export async function login(req, res) {
  const input = parseOrThrow(loginSchema, req.body);
  sendSession(res, 200, await authService.login(input, requestMeta(req)));
}

export async function refresh(req, res) {
  try {
    const session = await tokenService.rotateSession(req.cookies?.[COOKIE_NAME], requestMeta(req));
    sendSession(res, 200, session);
  } catch (err) {
    if (err?.code === "SESSION_REVOKED") res.clearCookie(COOKIE_NAME, cookieOptions());
    throw err;
  }
}

export async function logout(req, res) {
  await tokenService.endSession(req.cookies?.[COOKIE_NAME]);
  res.clearCookie(COOKIE_NAME, cookieOptions());
  res.status(204).end();
}

export async function me(req, res) {
  res.json({ user: await authService.getUser(req.userId) });
}
