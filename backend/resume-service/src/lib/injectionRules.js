// Prompt-injection rule set. guard-service is the primary user; resume- and
// interview-service keep a copy so they can still screen text when guard is down.
// Weights combine as a noisy-OR: one strong rule (0.9) blocks on its own,
// one medium rule (0.6) only sanitizes.

const STRONG = 0.9;
const MEDIUM = 0.6;
const WEAK = 0.3;

export const INJECTION_RULES = [
  {
    id: "override-instructions",
    category: "instruction_override",
    weight: STRONG,
    pattern:
      /\b(ignore|disregard|forget|override|bypass)\s+(all\s+|any\s+|the\s+|your\s+|these\s+|those\s+)*(previous|prior|above|earlier|preceding|system|original)?\s*(instructions?|rules?|prompts?|directions?|guidelines?|constraints?)\b(?!\s*(engine|file|table|config|set)\b)/gi,
  },
  {
    id: "new-instructions",
    category: "role_hijack",
    weight: MEDIUM,
    pattern: /\b(new|updated|real|actual)\s+(system\s+)?instructions?\s*:/gi,
  },
  {
    id: "you-are-now",
    category: "role_hijack",
    weight: MEDIUM,
    pattern:
      /\b(you\s+are\s+now|from\s+now\s+on,?\s+you|pretend\s+(to\s+be|you\s+are)|act\s+as\s+(an?\s+|the\s+)?(system|developer|admin|administrator|jailbroken|unrestricted))\b/gi,
  },
  {
    id: "jailbreak-mode",
    category: "role_hijack",
    weight: STRONG,
    pattern: /\b(dan|jailbreak|god|unrestricted)\s+mode\b/gi,
  },
  {
    // "developer mode" alone is common and harmless (browser dev tools), so require an
    // attempt to switch into it.
    id: "enter-privileged-mode",
    category: "role_hijack",
    weight: MEDIUM,
    pattern:
      /\b(enable|activate|enter|switch\s+to|you\s+are\s+(now\s+)?in)\s+(developer|admin|debug)\s+mode\b/gi,
  },
  {
    id: "reveal-prompt",
    category: "prompt_extraction",
    weight: MEDIUM,
    pattern:
      /\b(print|reveal|repeat|show|output|display|tell\s+me|leak)\s+(me\s+)?(your|the)\s+(full\s+|entire\s+|hidden\s+|initial\s+)?(system\s+prompt|prompt|instructions|rules)\b/gi,
  },
  {
    id: "what-instructions",
    category: "prompt_extraction",
    weight: WEAK,
    pattern: /\bwhat\s+(are|were)\s+your\s+(instructions|rules|system\s+prompt)\b/gi,
  },
  {
    id: "repeat-above",
    category: "prompt_extraction",
    weight: MEDIUM,
    pattern: /\brepeat\s+(everything|all|the\s+text)\s+(above|before)\b/gi,
  },
  {
    id: "grade-manipulation",
    category: "grade_manipulation",
    weight: MEDIUM,
    pattern:
      /\b(give|rate|score|grade|mark)\s+(me|this|my\s+answer|this\s+answer|the\s+candidate)\s+(a\s+|an\s+)?(10|ten|100|perfect|full\s+marks|maximum|highest|top)\b/gi,
  },
  {
    id: "mark-correct",
    category: "grade_manipulation",
    weight: MEDIUM,
    pattern:
      /\b(mark|treat|consider)\s+(this|my|the)\s+(answer|response)\s+(as\s+)?(correct|perfect|excellent)\b/gi,
  },
  {
    id: "chat-role-tokens",
    category: "role_tokens",
    weight: STRONG,
    pattern:
      /(<\|(im_start|im_end|system|user|assistant|endoftext|begin_of_text|start_header_id|end_header_id|eot_id)\|>|\[\/?INST\]|<<\/?SYS>>|<\/?\s*untrusted_[a-z_]*)/gi,
  },
  {
    id: "markdown-role-header",
    category: "role_tokens",
    weight: MEDIUM,
    pattern: /^\s*(#{1,6}\s*)?(system|assistant|developer)\s*(prompt|message)?\s*:/gim,
  },
];

const BASE64_BLOB = /[A-Za-z0-9+/]{200,}={0,2}/g;

function decodeBase64Blobs(text) {
  const decoded = [];
  for (const match of text.matchAll(BASE64_BLOB)) {
    try {
      const value = Buffer.from(match[0], "base64").toString("utf8");
      // Keep only blobs that decode to mostly printable text.
      if (/^[\x20-\x7E\s]{20,}$/.test(value)) decoded.push(value);
    } catch {
      // not base64; ignore
    }
  }
  return decoded;
}

/**
 * Scores text against the rule set.
 * Returns { score 0..1, reasons: [ruleId], spans: [matched text] }.
 */
export function scoreWithRules(text) {
  const value = String(text ?? "");
  const candidates = [value, ...decodeBase64Blobs(value)];
  const reasons = new Set();
  const spans = new Set();
  let keep = 1;

  for (const rule of INJECTION_RULES) {
    let matched = false;
    for (const candidate of candidates) {
      for (const match of candidate.matchAll(rule.pattern)) {
        matched = true;
        if (candidate === value) spans.add(match[0]);
      }
    }
    if (matched) {
      reasons.add(rule.id);
      keep *= 1 - rule.weight;
    }
  }

  return { score: Number((1 - keep).toFixed(3)), reasons: [...reasons], spans: [...spans] };
}

/** Replaces each matched span with "[removed]". */
export function removeSpans(text, spans) {
  let out = String(text ?? "");
  for (const span of spans) out = out.split(span).join("[removed]");
  return out;
}

/** Rules-only verdict, used locally when guard-service is unreachable. */
export function localVerdict(text, { blockAt = 0.85, sanitizeAt = 0.5 } = {}) {
  const { score, reasons, spans } = scoreWithRules(text);
  if (score >= blockAt) return { verdict: "block", score, reasons, sanitizedText: removeSpans(text, spans) };
  if (score >= sanitizeAt) return { verdict: "sanitize", score, reasons, sanitizedText: removeSpans(text, spans) };
  // Guard is down, so even "clean" text is reported as sanitize (never a silent allow).
  return { verdict: "sanitize", score, reasons: [...reasons, "guard_unavailable"], sanitizedText: text };
}
