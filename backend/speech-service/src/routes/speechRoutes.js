import { Router } from "express";
import multer from "multer";
import { env } from "../config/env.js";
import { AppError } from "../lib/AppError.js";
import { ALLOWED_AUDIO, baseMimeType, isCompatible, sniffAudio } from "../lib/audioType.js";
import { sanitizeText } from "../lib/sanitize.js";
import { transcribe } from "../services/transcribeService.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Math.floor(env.MAX_AUDIO_MB * 1024 * 1024), files: 1, fields: 2, fieldSize: 1024 },
}).single("audio");

const unsupported = () => new AppError("UNSUPPORTED_AUDIO", 415, "Unsupported audio format");

function receiveAudio(req, res, next) {
  upload(req, res, (err) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") {
      return next(new AppError("AUDIO_TOO_LARGE", 413, "Recording is too long (max 3 minutes)"));
    }
    next(new AppError("VALIDATION_ERROR", 400, "Send the recording as multipart field 'audio'"));
  });
}

export const speechRoutes = Router();

speechRoutes.post("/transcribe", receiveAudio, async (req, res) => {
  if (!req.file?.buffer?.length) {
    throw new AppError("VALIDATION_ERROR", 400, "Send the recording as multipart field 'audio'");
  }
  const mimetype = baseMimeType(req.file.mimetype);
  const extension = ALLOWED_AUDIO[mimetype];
  if (!extension || !isCompatible(extension, sniffAudio(req.file.buffer))) throw unsupported();

  const hint = req.body?.hint ? sanitizeText(req.body.hint, 300) : undefined;
  res.json(await transcribe({ buffer: req.file.buffer, extension, mimetype, hint }));
});
