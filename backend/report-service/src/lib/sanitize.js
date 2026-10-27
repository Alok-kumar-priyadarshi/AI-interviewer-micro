// Zero-width, soft hyphen, bidi embedding/override/isolate characters: invisible text tricks.
const INVISIBLE = /[\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;
// C0 controls except tab (09), newline (0A) and carriage return (0D), plus DEL.
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/**
 * Normalizes untrusted text before it is stored, guarded or sent to an LLM.
 * NFKC folds look-alike characters; invisible and control characters are removed;
 * long character runs and blank-line runs are collapsed; the result is trimmed and capped.
 */
export function sanitizeText(input, maxLength) {
  let text = String(input ?? "")
    .normalize("NFKC")
    .replace(INVISIBLE, "")
    .replace(CONTROL, "")
    .replace(/\r\n?/g, "\n");
  text = text.replace(/(.)\1{10,}/gu, (_match, ch) => ch.repeat(10));
  text = text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return maxLength ? text.slice(0, maxLength) : text;
}
