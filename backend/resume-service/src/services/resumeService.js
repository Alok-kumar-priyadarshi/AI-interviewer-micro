import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { env } from "../config/env.js";
import { errors, fetchPublicDriveFile } from "../clients/driveFetcher.js";
import { guardCheck } from "../clients/guardClient.js";
import { db } from "../db/client.js";
import { resumeChunks, resumes } from "../db/schema.js";
import { AppError } from "../lib/AppError.js";
import { parseDriveUrl } from "../lib/driveUrl.js";
import { detectFileType, MIME_TYPES } from "../lib/fileType.js";
import { logger } from "../lib/logger.js";
import { sanitizeText } from "../lib/sanitize.js";
import { buildChunks } from "./chunker.js";
import { embedTexts } from "./embedder.js";
import { extractResumeText, readableLength } from "./extractText.js";
import { allSkills, extractProfile } from "./profileExtractor.js";
import { classifyResume, heuristicScore } from "./resumeDetector.js";

const MIN_READABLE_CHARS = 200;
const MAX_TEXT_CHARS = 20_000;
const MIN_HEURISTIC = 0.2;
const MIN_LLM_CONFIDENCE = 0.6;

const notAResume = () => new AppError("NOT_A_RESUME", 422, "Please add resume link");
const notFound = () => new AppError("NOT_FOUND", 404, "Not found");

function toResume(row) {
  return {
    id: row.id,
    fileName: row.fileName,
    sourceUrl: row.sourceUrl,
    profile: row.profile,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Full ingestion pipeline. Cheap checks run first and every failure maps to exactly one
 * user-facing message (see docs/diagrams/04-resume-validation-flow.md).
 */
export async function createResume(userId, driveUrl, requestId) {
  const link = parseDriveUrl(driveUrl);
  if (link.kind === "invalid") throw errors.invalidUrl();
  if (link.kind === "not_file") throw errors.linkNotValid();

  const file = await fetchPublicDriveFile(link.fileId, {
    maxMb: env.MAX_RESUME_MB,
    timeoutMs: env.DRIVE_FETCH_TIMEOUT_MS,
  });
  const type = detectFileType(file.buffer);
  if (!type) throw errors.linkNotValid();

  const extracted = sanitizeText(await extractResumeText(file.buffer, type), MAX_TEXT_CHARS);
  if (readableLength(extracted) < MIN_READABLE_CHARS) throw errors.linkNotValid();

  const guard = await guardCheck(extracted, "resume", requestId);
  if (guard.verdict === "block") {
    throw new AppError("RESUME_UNSAFE", 422, "Resume contains disallowed content");
  }
  const text = guard.sanitizedText ?? extracted;

  if (heuristicScore(text) < MIN_HEURISTIC) throw notAResume();
  const verdict = await classifyResume(text);
  if (!verdict.isResume || verdict.confidence < MIN_LLM_CONFIDENCE) throw notAResume();

  const profile = await extractProfile(text);
  const chunks = buildChunks(profile, text);
  const vectors = await embedTexts(chunks.map((chunk) => chunk.embedText));

  const [existing] = await db
    .select({ id: resumes.id })
    .from(resumes)
    .where(and(eq(resumes.userId, userId), eq(resumes.driveFileId, link.fileId)))
    .limit(1);
  const resumeId = existing?.id ?? randomUUID();
  const now = new Date();
  const values = {
    fileName: file.fileName,
    sourceUrl: String(driveUrl).trim().slice(0, 2000),
    mimeType: MIME_TYPES[type],
    sizeBytes: file.buffer.length,
    rawText: text,
    profile,
    resumeConfidence: Number(verdict.confidence.toFixed(2)),
    guardFlags: guard.verdict === "sanitize" ? guard.reasons : [],
    updatedAt: now,
  };

  const [saved] = await db.batch([
    db
      .insert(resumes)
      .values({ id: resumeId, userId, driveFileId: link.fileId, ...values })
      .onConflictDoUpdate({ target: [resumes.userId, resumes.driveFileId], set: values })
      .returning(),
    db.delete(resumeChunks).where(eq(resumeChunks.resumeId, resumeId)),
    db.insert(resumeChunks).values(
      chunks.map((chunk, i) => ({
        resumeId,
        section: chunk.section,
        title: chunk.title,
        content: chunk.content,
        tokenCount: chunk.tokenCount,
        embedding: vectors[i],
      })),
    ),
  ]);

  logger.info("resume_ingested", {
    requestId,
    resumeId,
    chunks: chunks.length,
    embedded: vectors.filter(Boolean).length,
    guard: guard.verdict,
  });
  return toResume(saved[0]);
}

export async function listResumes(userId) {
  const rows = await db
    .select()
    .from(resumes)
    .where(eq(resumes.userId, userId))
    .orderBy(desc(resumes.createdAt))
    .limit(50);
  return rows.map((row) => ({
    id: row.id,
    fileName: row.fileName,
    name: row.profile?.name ?? null,
    headline: row.profile?.headline ?? null,
    topSkills: allSkills(row.profile).slice(0, 8),
    projectNames: (row.profile?.projects ?? []).map((p) => p.name).slice(0, 6),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
}

export async function getOwnedResumeRow(userId, resumeId) {
  const [row] = await db
    .select()
    .from(resumes)
    .where(and(eq(resumes.id, resumeId), eq(resumes.userId, userId)))
    .limit(1);
  if (!row) throw notFound();
  return row;
}

export async function getResume(userId, resumeId) {
  return toResume(await getOwnedResumeRow(userId, resumeId));
}

export async function deleteResume(userId, resumeId) {
  const deleted = await db
    .delete(resumes)
    .where(and(eq(resumes.id, resumeId), eq(resumes.userId, userId)))
    .returning({ id: resumes.id });
  if (!deleted.length) throw notFound();
}
