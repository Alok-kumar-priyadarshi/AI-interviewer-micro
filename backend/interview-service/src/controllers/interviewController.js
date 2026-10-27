import { z } from "zod";
import { AppError } from "../lib/AppError.js";
import { LEVELS, QUESTION_COUNTS } from "../lib/levels.js";
import { parseOrThrow, UUID_RE } from "../lib/validate.js";
import { submitAnswer } from "../services/gradingService.js";
import { streamNextQuestion } from "../services/questionService.js";
import * as sessionService from "../services/sessionService.js";

const createSchema = z.object({
  resumeId: z.uuid(),
  level: z.enum(LEVELS),
  questionCount: z.coerce
    .number()
    .int()
    .refine((n) => QUESTION_COUNTS.includes(n), "Choose 5, 8 or 12 questions"),
});

const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.iso.datetime({ offset: true }).optional(),
});

const answerSchema = z.object({
  answerText: z.string().trim().min(1, "Answer cannot be empty").max(4000),
  answerMode: z.enum(["text", "voice"]),
  transcriptRaw: z.string().max(6000).nullish(),
  audioDurationSec: z.number().min(0).max(600).nullish(),
});

function idParam(value) {
  if (!UUID_RE.test(value ?? "")) throw new AppError("NOT_FOUND", 404, "Not found");
  return value.toLowerCase();
}

export async function create(req, res) {
  const input = parseOrThrow(createSchema, req.body);
  res.status(201).json({ session: await sessionService.createSession(req.userId, input, req.id) });
}

export async function list(req, res) {
  res.json(await sessionService.listSessions(req.userId, parseOrThrow(listSchema, req.query)));
}

export async function get(req, res) {
  res.json(await sessionService.getSession(req.userId, idParam(req.params.id)));
}

export async function next(req, res) {
  await streamNextQuestion({ userId: req.userId, sessionId: idParam(req.params.id), requestId: req.id }, res);
}

export async function answer(req, res) {
  const input = parseOrThrow(answerSchema, req.body);
  res.json(
    await submitAnswer({
      userId: req.userId,
      sessionId: idParam(req.params.id),
      turnId: idParam(req.params.turnId),
      input,
      requestId: req.id,
    }),
  );
}

export async function end(req, res) {
  res.json(await sessionService.endSession(req.userId, idParam(req.params.id), req.id));
}
