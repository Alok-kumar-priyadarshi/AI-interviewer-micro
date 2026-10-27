import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { computeComparison, computeNumbers } from "../src/services/scoring.js";

vi.mock("../src/db/client.js", async () => {
  const { createTestDb, isUniqueViolation } = await import("./helpers/testDb.js");
  const { db } = await createTestDb();
  return { db, isUniqueViolation };
});

const chatJson = vi.fn();
vi.mock("../src/clients/groq.js", () => ({ chatJson: (...a) => chatJson(...a) }));

const { default: app } = await import("../src/app.js");

const USER = "3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90";
const OTHER = "9b1c2d3e-4f50-4a61-8b72-93a4b5c6d7e8";
const RESUME = "11111111-2222-4333-8444-555555555555";
let sessionCounter = 0;
const newSessionId = () => `00000000-0000-4000-8000-${String(++sessionCounter).padStart(12, "0")}`;

const turn = (idx, overrides = {}) => ({
  idx,
  planItem: idx,
  category: "project",
  isFollowUp: false,
  topic: "ShopLite",
  questionText: `Question ${idx}?`,
  answerText: `Answer ${idx}`,
  answerMode: "text",
  transcriptRaw: null,
  audioDurationSec: null,
  rubric: { correctness: 8, depth: 6, communication: 10 },
  score: 7.8,
  feedback: { strengths: ["Clear"], gaps: ["No numbers"], idealAnswerHints: ["Mention TTL"], integrity: null },
  guardVerdict: "allow",
  answeredAt: new Date().toISOString(),
  ...overrides,
});

const payload = (sessionId, turns, userId = USER) => ({
  session: {
    id: sessionId,
    userId,
    resumeId: RESUME,
    level: "medium",
    questionCount: 5,
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
  },
  profileSummary: { name: "Asha Rao", resumeName: "Asha_CV.pdf" },
  turns,
});

const as = (userId) => ({
  post: (path) => request(app).post(path).set("x-internal-key", process.env.INTERNAL_API_KEY).set("x-user-id", userId),
  get: (path) => request(app).get(path).set("x-internal-key", process.env.INTERNAL_API_KEY).set("x-user-id", userId),
});

function narrative({ improvements = [{ topic: "Caching", advice: "Explain invalidation." }] } = {}) {
  chatJson.mockResolvedValue({
    data: {
      summary: "Solid interview.",
      strengths: ["Clear explanations"],
      improvements,
      recommendedTopics: ["Redis"],
      perItemHints: [{ idx: 0, hints: ["Talk about TTLs"] }],
    },
    model: "openai/gpt-oss-120b",
  });
}

beforeEach(() => {
  chatJson.mockReset();
  narrative();
});

describe("computeNumbers", () => {
  it("weights follow-ups at half and ignores unanswered turns", () => {
    const numbers = computeNumbers([
      turn(0, { category: "intro", score: 8, rubric: { correctness: 8, depth: 8, communication: 6 } }),
      turn(1, { score: 6, rubric: { correctness: 6, depth: 6, communication: 8 } }),
      turn(2, { score: 2, isFollowUp: true, rubric: { correctness: 2, depth: 2, communication: 4 } }),
      turn(3, { category: "technical", answerText: null, answeredAt: null, score: null, rubric: null }),
    ]);
    // (8 + 6 + 0.5*2) / 2.5 = 6.0 → 60
    expect(numbers.overallScore).toBe(60);
    expect(numbers.questionsAnswered).toBe(3);
    expect(numbers.categoryScores).toMatchObject({ intro: 8, project: 4.7, technical: null, behavioral: null });
    expect(numbers.categoryScores.communication).toBe(6.4);
  });

  it("returns null scores when nothing was answered", () => {
    expect(computeNumbers([turn(0, { answerText: null, answeredAt: null, score: null })]).overallScore).toBeNull();
  });
});

describe("computeComparison", () => {
  it("averages earlier reports and finds recurring weak topics", () => {
    const previous = [
      { sessionId: "b", createdAt: "2026-10-20", level: "medium", overallScore: 50, categoryScores: { project: 5 }, improvements: [{ topic: "caching" }] },
      { sessionId: "a", createdAt: "2026-10-10", level: "low", overallScore: 70, categoryScores: { project: 7 }, improvements: [{ topic: "SQL" }] },
    ];
    const result = computeComparison(previous, {
      sessionId: "c",
      date: "2026-10-26",
      level: "medium",
      overallScore: 72,
      categoryScores: { project: 8 },
      improvements: [{ topic: "Caching" }],
    });
    expect(result).toMatchObject({ previousCount: 2, previousAverage: 60, delta: 12, categoryDeltas: { project: 2 } });
    expect(result.trend.map((p) => p.sessionId)).toEqual(["a", "b", "c"]);
    expect(result.recurringWeakTopics).toEqual(["Caching"]);
  });
});

describe("report-service API", () => {
  it("creates a report with every Q&A, keeping answer mode and raw transcript", async () => {
    const sessionId = newSessionId();
    const res = await as(USER)
      .post("/internal/reports")
      .send(payload(sessionId, [turn(0), turn(1, { answerMode: "voice", transcriptRaw: "raw words", audioDurationSec: 12.5 })]));
    expect(res.status).toBe(201);

    const got = await as(USER).get(`/api/reports/by-session/${sessionId}`);
    expect(got.status).toBe(200);
    expect(got.body.report).toMatchObject({ overallScore: 78, questionsAnswered: 2, summary: "Solid interview.", modelUsed: "openai/gpt-oss-120b" });
    expect(got.body.items).toHaveLength(2);
    expect(got.body.items[0]).toMatchObject({ question: "Question 0?", answerMode: "text", idealAnswerHints: ["Talk about TTLs"] });
    expect(got.body.items[1]).toMatchObject({ answerMode: "voice", transcriptRaw: "raw words", audioDurationSec: 12.5, idealAnswerHints: ["Mention TTL"] });
  });

  it("is idempotent per session", async () => {
    const sessionId = newSessionId();
    const first = await as(USER).post("/internal/reports").send(payload(sessionId, [turn(0)]));
    const second = await as(USER).post("/internal/reports").send(payload(sessionId, [turn(0)]));
    expect(second.body.reportId).toBe(first.body.reportId);
    expect(chatJson).toHaveBeenCalledTimes(1);
  });

  it("records integrity notes for blocked answers", async () => {
    const sessionId = newSessionId();
    await as(USER)
      .post("/internal/reports")
      .send(payload(sessionId, [turn(0, { guardVerdict: "block", score: 0, rubric: null, feedback: { integrity: "manipulation_attempt" } })]));
    const got = await as(USER).get(`/api/reports/by-session/${sessionId}`);
    expect(got.body.report.integrityNotes).toEqual([{ idx: 0, note: expect.stringContaining("not evaluated") }]);
  });

  it("skips the model when nothing was answered", async () => {
    const sessionId = newSessionId();
    await as(USER).post("/internal/reports").send(payload(sessionId, [turn(0, { answerText: null, answeredAt: null, score: null, rubric: null, answerMode: null })]));
    expect(chatJson).not.toHaveBeenCalled();
    const got = await as(USER).get(`/api/reports/by-session/${sessionId}`);
    expect(got.body.report).toMatchObject({ overallScore: null, modelUsed: "none", recommendedTopics: ["ShopLite"] });
  });

  it("compares with the user's earlier reports", async () => {
    const userId = "55555555-6666-4777-8888-999999999999";
    await as(userId).post("/internal/reports").send(payload(newSessionId(), [turn(0, { score: 5, rubric: { correctness: 5, depth: 5, communication: 5 } })], userId));
    const sessionId = newSessionId();
    await as(userId).post("/internal/reports").send(payload(sessionId, [turn(0, { score: 8 })], userId));
    const got = await as(userId).get(`/api/reports/by-session/${sessionId}`);
    expect(got.body.report.comparison).toMatchObject({ previousCount: 1, previousAverage: 50, delta: 30, recurringWeakTopics: ["Caching"] });
    expect(got.body.report.comparison.trend).toHaveLength(2);

    const list = await as(userId).get("/api/reports");
    expect(list.body.items.map((r) => r.overallScore)).toEqual([80, 50]);
  });

  it("returns 503 when the narrative model is unavailable, storing nothing", async () => {
    const { AppError } = await import("../src/lib/AppError.js");
    chatJson.mockImplementation(async () => {
      throw new AppError("AI_BUSY", 503, "busy");
    });
    const sessionId = newSessionId();
    const res = await as(USER).post("/internal/reports").send(payload(sessionId, [turn(0)]));
    expect(res.status).toBe(503);
    expect((await as(USER).get(`/api/reports/by-session/${sessionId}`)).status).toBe(404);
  });

  it("refuses a session that belongs to another user and hides reports across users", async () => {
    const sessionId = newSessionId();
    const mismatch = await as(OTHER).post("/internal/reports").send(payload(sessionId, [turn(0)], USER));
    expect(mismatch.status).toBe(400);
    await as(USER).post("/internal/reports").send(payload(sessionId, [turn(0)]));
    expect((await as(OTHER).get(`/api/reports/by-session/${sessionId}`)).status).toBe(404);
  });

  it("validates the payload", async () => {
    const res = await as(USER).post("/internal/reports").send({ session: {}, turns: "x" });
    expect(res.status).toBe(400);
  });
});
