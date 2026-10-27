import { describe, expect, it } from "vitest";
import { CATEGORY_MIX } from "../src/lib/levels.js";
import { computeScore, decideNext, effectiveStatus } from "../src/services/flow.js";
import { normalizePlan } from "../src/services/planRules.js";
import { cleanQuestion, fallbackQuestion, isAcceptableQuestion } from "../src/services/questionService.js";

const summary = { projectNames: ["ShopLite", "ChatNow", "Budgety"], topSkills: ["React", "PostgreSQL", "Docker"] };

describe("normalizePlan", () => {
  it.each([5, 8, 12])("matches the category mix for %i questions even from an empty plan", (count) => {
    const plan = normalizePlan([], count, summary);
    expect(plan).toHaveLength(count);
    const counts = plan.reduce((acc, p) => ({ ...acc, [p.category]: (acc[p.category] ?? 0) + 1 }), {});
    expect(counts).toEqual(CATEGORY_MIX[count]);
    expect(plan.map((p) => p.index)).toEqual([...Array(count).keys()]);
  });

  it("keeps good model items, drops duplicates and extras, and orders intro → alternating → behavioral", () => {
    const plan = normalizePlan(
      [
        { category: "behavioral", topic: "Conflict", focus: "resolution", sourceSection: "experience" },
        { category: "project", topic: "ShopLite", focus: "caching", sourceSection: "project" },
        { category: "project", topic: "shoplite", focus: "dup", sourceSection: "project" },
        { category: "technical", topic: "React", focus: "hooks", sourceSection: "skills" },
        { category: "intro", topic: "Story", focus: "path", sourceSection: "summary" },
        { category: "intro", topic: "Extra intro", focus: "x", sourceSection: "summary" },
        { category: "nonsense", topic: "x", focus: "y", sourceSection: "z" },
      ],
      5,
      summary,
    );
    expect(plan.map((p) => `${p.category}:${p.topic}`)).toEqual([
      "intro:Story",
      "project:ShopLite",
      "technical:React",
      "project:ChatNow",
      "behavioral:Conflict",
    ]);
  });
});

const session = (level, items = 3) => ({ level, plan: Array.from({ length: items }, (_, i) => ({ index: i })) });
const turn = (planItem, opts = {}) => ({
  planItem,
  isFollowUp: false,
  answeredAt: new Date(),
  feedback: { needsFollowUp: false },
  guardVerdict: "allow",
  ...opts,
});

describe("decideNext", () => {
  it("starts at the first plan item", () => {
    expect(decideNext(session("low"), [])).toEqual({ action: "next_topic", planItem: 0 });
  });

  it("returns the pending turn when the last one is unanswered", () => {
    const pending = turn(0, { answeredAt: null });
    expect(decideNext(session("low"), [pending])).toEqual({ action: "pending", turn: pending });
  });

  it("allows one follow-up at low and medium, two at high", () => {
    const wants = { feedback: { needsFollowUp: true } };
    const first = [turn(0, wants)];
    const second = [turn(0, wants), turn(0, { ...wants, isFollowUp: true })];
    expect(decideNext(session("low"), first).action).toBe("follow_up");
    expect(decideNext(session("low"), second)).toEqual({ action: "next_topic", planItem: 1 });
    expect(decideNext(session("medium"), second).action).toBe("next_topic");
    expect(decideNext(session("high"), second).action).toBe("follow_up");
  });

  it("never follows up a blocked answer", () => {
    const blocked = [turn(0, { feedback: { needsFollowUp: true }, guardVerdict: "block" })];
    expect(decideNext(session("high"), blocked).action).toBe("next_topic");
  });

  it("completes after the last plan item", () => {
    expect(decideNext(session("low", 2), [turn(0), turn(1)])).toEqual({ action: "complete" });
  });
});

describe("scoring and status", () => {
  it("weights correctness 0.5, depth 0.3, communication 0.2 and clamps", () => {
    expect(computeScore({ correctness: 8, depth: 6, communication: 10 })).toBe(7.8);
    expect(computeScore({ correctness: 99, depth: -4, communication: "x" })).toBe(5);
  });

  it("computes abandoned for idle in-progress sessions only", () => {
    const old = new Date(Date.now() - 25 * 3600 * 1000);
    expect(effectiveStatus({ status: "in_progress", lastActivityAt: old })).toBe("abandoned");
    expect(effectiveStatus({ status: "completed", lastActivityAt: old })).toBe("completed");
    expect(effectiveStatus({ status: "in_progress", lastActivityAt: new Date() })).toBe("in_progress");
  });
});

describe("question checks", () => {
  it("cleans labels and quotes", () => {
    expect(cleanQuestion('Question: "How did you cache   product pages?"')).toBe("How did you cache product pages?");
  });

  it("rejects leaks, non-questions and bad lengths", () => {
    expect(isAcceptableQuestion("How did you scale it?", "CANARY123456")).toBe(true);
    expect(isAcceptableQuestion("Tell me about it.", "CANARY123456")).toBe(false);
    expect(isAcceptableQuestion("What is CANARY123456 here?", "CANARY123456")).toBe(false);
    expect(isAcceptableQuestion("Is <untrusted_answer> ok?", "CANARY123456")).toBe(false);
  });

  it("builds a template question when the model fails", () => {
    expect(fallbackQuestion({ topic: "ShopLite", focus: "caching strategy." })).toBe(
      "Can you walk me through ShopLite, focusing on caching strategy?",
    );
    expect(fallbackQuestion({}, { angle: "how was invalidation tested" })).toContain("how was invalidation tested?");
  });
});
