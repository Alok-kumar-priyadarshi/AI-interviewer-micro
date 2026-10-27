/**
 * Checks model output for signs that the prompt leaked or the model was steered:
 * the per-request canary, or our own untrusted-tag names showing up in the text.
 */
export function checkOutput(text, { canary } = {}) {
  const value = String(text ?? "");
  if (canary && value.includes(canary)) return { ok: false, reason: "canary_leak" };
  if (/untrusted_[a-z]+/i.test(value)) return { ok: false, reason: "tag_leak" };
  return { ok: true };
}

/** Recursively checks every string inside a parsed JSON value. */
export function checkJsonOutput(value, options) {
  return checkOutput(JSON.stringify(value ?? null), options);
}
