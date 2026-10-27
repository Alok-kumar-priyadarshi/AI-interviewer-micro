import { randomUUID } from "node:crypto";

const VALID_ID = /^[A-Za-z0-9-]{8,64}$/;

/** Reuses a well-formed incoming x-request-id (set by the gateway) or creates one. */
export function requestId(req, res, next) {
  const incoming = req.get("x-request-id");
  req.id = incoming && VALID_ID.test(incoming) ? incoming : randomUUID();
  res.set("x-request-id", req.id);
  next();
}
