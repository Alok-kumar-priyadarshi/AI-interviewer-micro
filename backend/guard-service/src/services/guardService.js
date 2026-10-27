import { env } from "../config/env.js";
import { removeSpans, scoreWithRules } from "../lib/injectionRules.js";
import { sanitizeText } from "../lib/sanitize.js";
import { scoreWithModel } from "./modelScorer.js";

/**
 * Scores untrusted text for prompt-injection risk.
 * score = max(rule score, model score). Verdict: block / sanitize / allow by the env thresholds.
 * When no model is reachable the verdict is at least "sanitize" (never a silent allow).
 */
export async function checkText(text) {
  const clean = sanitizeText(text, 30_000);
  const rules = scoreWithRules(clean);
  const model = await scoreWithModel(clean);

  const score = Math.max(rules.score, model.score ?? 0);
  const reasons = [...rules.reasons];
  if (model.score === null) reasons.push("model_unavailable");
  else if (model.score >= env.GUARD_SANITIZE_THRESHOLD) reasons.push(model.source);

  let verdict = "allow";
  if (score >= env.GUARD_BLOCK_THRESHOLD) verdict = "block";
  else if (score >= env.GUARD_SANITIZE_THRESHOLD || model.score === null) verdict = "sanitize";

  return {
    verdict,
    score: Number(score.toFixed(3)),
    reasons,
    sanitizedText: verdict === "allow" ? clean : removeSpans(clean, rules.spans),
  };
}
