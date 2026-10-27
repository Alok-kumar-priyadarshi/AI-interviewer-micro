import { Router } from "express";
import { z } from "zod";
import { parseOrThrow } from "../lib/validate.js";
import { checkText } from "../services/guardService.js";

const checkSchema = z.object({
  text: z.string().max(30_000),
  source: z.enum(["resume", "answer", "text"]).default("text"),
});

export const guardRoutes = Router();

guardRoutes.post("/check", async (req, res) => {
  const { text } = parseOrThrow(checkSchema, req.body);
  res.json(await checkText(text));
});
