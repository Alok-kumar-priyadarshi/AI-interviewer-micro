import { Router } from "express";
import { env } from "../config/env.js";
import { proxyRequest } from "../lib/proxy.js";
import { verifyJwt } from "../middleware/verifyJwt.js";

// Auth endpoints that work without an access token (they use the refresh cookie or a password).
const PUBLIC_AUTH_PATHS = new Set(["/signup", "/login", "/refresh", "/logout"]);

const ROUTES = [
  {
    prefix: "/api/auth",
    target: env.AUTH_SERVICE_URL,
    forwardCookies: true,
    publicPaths: PUBLIC_AUTH_PATHS,
  },
  { prefix: "/api/resumes", target: env.RESUME_SERVICE_URL },
  { prefix: "/api/interviews", target: env.INTERVIEW_SERVICE_URL },
  { prefix: "/api/speech", target: env.SPEECH_SERVICE_URL },
  { prefix: "/api/reports", target: env.REPORT_SERVICE_URL },
];

export function buildProxyRouter() {
  const router = Router();

  for (const route of ROUTES) {
    const authenticate = (req, res, next) => {
      req.isPublicRoute = req.method === "POST" && Boolean(route.publicPaths?.has(req.path));
      if (req.isPublicRoute) return next();
      return verifyJwt(req, res, next);
    };

    const forward = (req, res) =>
      proxyRequest(req, res, {
        target: route.target,
        userId: req.isPublicRoute ? undefined : req.userId,
        forwardCookies: Boolean(route.forwardCookies),
      });

    router.use(route.prefix, authenticate, forward);
  }

  return router;
}
