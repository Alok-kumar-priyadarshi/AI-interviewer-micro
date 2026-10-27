import { z } from "zod";
import { AppError } from "../lib/AppError.js";
import { parseOrThrow, UUID_RE } from "../lib/validate.js";
import * as resumeService from "../services/resumeService.js";
import { searchChunks } from "../services/searchService.js";

const createSchema = z.object({ driveUrl: z.string().trim().min(1, "Paste a Google Drive link").max(2000) });
const searchSchema = z.object({
  query: z.string().trim().min(1).max(500),
  k: z.coerce.number().int().min(1).max(5).default(3),
});

/** A malformed id can never match a row, so it is a plain 404 (and never reaches SQL). */
function resumeIdParam(req) {
  if (!UUID_RE.test(req.params.id)) throw new AppError("NOT_FOUND", 404, "Not found");
  return req.params.id.toLowerCase();
}

export async function create(req, res) {
  const { driveUrl } = parseOrThrow(createSchema, req.body);
  res.status(201).json({ resume: await resumeService.createResume(req.userId, driveUrl, req.id) });
}

export async function list(req, res) {
  res.json({ items: await resumeService.listResumes(req.userId) });
}

export async function get(req, res) {
  res.json({ resume: await resumeService.getResume(req.userId, resumeIdParam(req)) });
}

export async function remove(req, res) {
  await resumeService.deleteResume(req.userId, resumeIdParam(req));
  res.status(204).end();
}

export async function internalProfile(req, res) {
  const row = await resumeService.getOwnedResumeRow(req.userId, resumeIdParam(req));
  res.json({ profile: row.profile, fileName: row.fileName });
}

export async function internalSearch(req, res) {
  const { query, k } = parseOrThrow(searchSchema, req.body);
  res.json({ chunks: await searchChunks(req.userId, resumeIdParam(req), query, k) });
}
