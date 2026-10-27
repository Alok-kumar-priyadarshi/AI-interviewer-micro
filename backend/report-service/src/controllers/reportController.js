import { z } from "zod";
import { AppError } from "../lib/AppError.js";
import { parseOrThrow, UUID_RE } from "../lib/validate.js";
import * as reportService from "../services/reportService.js";

const nullableDate = z.coerce.date().nullable().optional();

const turnSchema = z.object({
  idx: z.number().int().min(0),
  planItem: z.number().int().min(0),
  category: z.enum(["intro", "project", "technical", "behavioral"]),
  isFollowUp: z.boolean(),
  topic: z.string().max(200).nullable().optional(),
  questionText: z.string().min(1).max(2000),
  answerText: z.string().max(8000).nullable(),
  answerMode: z.enum(["text", "voice"]).nullable(),
  transcriptRaw: z.string().max(8000).nullable(),
  audioDurationSec: z.number().nullable(),
  rubric: z
    .object({ correctness: z.number(), depth: z.number(), communication: z.number() })
    .nullable(),
  score: z.number().min(0).max(10).nullable(),
  feedback: z
    .object({
      strengths: z.array(z.string()).optional(),
      gaps: z.array(z.string()).optional(),
      idealAnswerHints: z.array(z.string()).optional(),
      integrity: z.string().nullable().optional(),
    })
    .loose()
    .nullable(),
  guardVerdict: z.enum(["allow", "sanitize", "block"]).nullable(),
  answeredAt: nullableDate,
});

const createSchema = z.object({
  session: z.object({
    id: z.uuid(),
    userId: z.uuid(),
    resumeId: z.uuid(),
    level: z.enum(["low", "medium", "high"]),
    questionCount: z.number().int(),
    startedAt: nullableDate,
    endedAt: nullableDate,
  }),
  profileSummary: z.record(z.string(), z.unknown()).nullable(),
  turns: z.array(turnSchema).max(80),
});

const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.iso.datetime({ offset: true }).optional(),
});

export async function create(req, res) {
  const payload = parseOrThrow(createSchema, req.body);
  res.status(201).json(await reportService.createReport(req.userId, payload));
}

export async function list(req, res) {
  res.json(await reportService.listReports(req.userId, parseOrThrow(listSchema, req.query)));
}

export async function getBySession(req, res) {
  if (!UUID_RE.test(req.params.sessionId)) throw new AppError("NOT_FOUND", 404, "Not found");
  res.json(await reportService.getReportBySession(req.userId, req.params.sessionId.toLowerCase()));
}
