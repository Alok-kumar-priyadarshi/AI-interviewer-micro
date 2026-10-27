import { FOLLOW_UP_LIMIT } from "../lib/levels.js";

const ABANDON_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * Decides what happens after the latest turn:
 * - { action: "pending", turn }                    latest question not answered yet
 * - { action: "follow_up", planItem, parent }      the grader wants more and the level allows it
 * - { action: "next_topic", planItem }             move on in the plan
 * - { action: "complete" }                         plan exhausted
 */
export function decideNext(session, turns) {
  const last = turns.at(-1);
  if (!last) return { action: "next_topic", planItem: 0 };
  if (!last.answeredAt) return { action: "pending", turn: last };

  const followUpsUsed = turns.filter((t) => t.planItem === last.planItem && t.isFollowUp).length;
  const wantsFollowUp = Boolean(last.feedback?.needsFollowUp) && last.guardVerdict !== "block";
  if (wantsFollowUp && followUpsUsed < FOLLOW_UP_LIMIT[session.level]) {
    return { action: "follow_up", planItem: last.planItem, parent: last };
  }

  const nextItem = last.planItem + 1;
  if (nextItem >= session.plan.length) return { action: "complete" };
  return { action: "next_topic", planItem: nextItem };
}

/** "abandoned" is computed on read: an unfinished session idle for 24 hours. */
export function effectiveStatus(session, now = Date.now()) {
  const idle = now - new Date(session.lastActivityAt).getTime();
  if (session.status === "in_progress" && idle > ABANDON_AFTER_MS) return "abandoned";
  return session.status;
}

/** Weighted rubric → 0..10 score with one decimal. Computed here, never by the model. */
export function computeScore({ correctness, depth, communication }) {
  const clamp = (x) => Math.max(0, Math.min(10, Number(x) || 0));
  const raw = 0.5 * clamp(correctness) + 0.3 * clamp(depth) + 0.2 * clamp(communication);
  return Math.round(raw * 10) / 10;
}
