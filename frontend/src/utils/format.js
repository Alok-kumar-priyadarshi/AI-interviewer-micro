export const LEVEL_LABELS = { low: "Low", medium: "Medium", high: "High" };

export const CATEGORY_LABELS = {
  intro: "Introduction",
  project: "Project",
  technical: "Technical",
  behavioral: "Behavioral",
  communication: "Communication",
};

export const STATUS_LABELS = {
  created: "Not started",
  in_progress: "In progress",
  abandoned: "Paused",
  completed: "Completed",
};

export function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function formatShortDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(value));
}

/** Tailwind text colour for a score on a 0..max scale. */
export function scoreTone(score, max = 10) {
  if (score == null) return "text-slate-400";
  const ratio = score / max;
  if (ratio >= 0.75) return "text-emerald-600";
  if (ratio >= 0.5) return "text-amber-600";
  return "text-rose-600";
}

export function formatDuration(seconds) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function signed(value) {
  if (value == null) return "";
  return value > 0 ? `+${value}` : String(value);
}
