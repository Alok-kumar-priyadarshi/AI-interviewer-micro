import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { driveResponse, fakeEmbedding, INVOICE_LINES, makePdf, PROFILE, RESUME_LINES } from "./helpers/fixtures.js";

vi.mock("../src/db/client.js", async () => {
  const { createTestDb, isUniqueViolation } = await import("./helpers/testDb.js");
  const { db } = await createTestDb();
  return { db, isUniqueViolation };
});

const chatJson = vi.fn();
vi.mock("../src/clients/groq.js", () => ({ chatJson: (...args) => chatJson(...args) }));

const guardCheck = vi.fn();
vi.mock("../src/clients/guardClient.js", () => ({ guardCheck: (...args) => guardCheck(...args) }));

vi.mock("../src/services/embedder.js", () => ({
  embedTexts: async (texts) => texts.map((text) => fakeEmbedding(text)),
}));

const { default: app } = await import("../src/app.js");

const USER_A = "3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90";
const USER_B = "9b1c2d3e-4f50-4a61-8b72-93a4b5c6d7e8";
const FILE_ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz012345";
const LINK = `https://drive.google.com/file/d/${FILE_ID}/view?usp=sharing`;

const as = (userId) => ({
  post: (path) => request(app).post(path).set("x-internal-key", process.env.INTERNAL_API_KEY).set("x-user-id", userId),
  get: (path) => request(app).get(path).set("x-internal-key", process.env.INTERNAL_API_KEY).set("x-user-id", userId),
  del: (path) => request(app).delete(path).set("x-internal-key", process.env.INTERNAL_API_KEY).set("x-user-id", userId),
});

function serveFile(body, contentType = "application/pdf") {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(async () =>
      driveResponse({ headers: { "content-type": contentType, "content-disposition": 'attachment; filename="Asha_CV.pdf"' }, body }),
    ),
  );
}

function aiAnswers({ isResume = true, confidence = 0.95 } = {}) {
  chatJson.mockImplementation(async ({ task }) => {
    if (task === "resume_classifier") return { data: { isResume, confidence, reason: "test" }, model: "m" };
    if (task === "profile_extraction") return { data: structuredClone(PROFILE), model: "m" };
    throw new Error(`unexpected task ${task}`);
  });
}

beforeEach(() => {
  chatJson.mockReset();
  guardCheck.mockReset();
  guardCheck.mockImplementation(async (text) => ({ verdict: "allow", score: 0, reasons: [], sanitizedText: text }));
  aiAnswers();
});
afterEach(() => vi.unstubAllGlobals());

describe("POST /api/resumes", () => {
  it("rejects malformed links before any network call", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await as(USER_A).post("/api/resumes").send({ driveUrl: "not a link" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({ code: "INVALID_URL", message: "Not a valid URL" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects folder links", async () => {
    const res = await as(USER_A).post("/api/resumes").send({ driveUrl: `https://drive.google.com/drive/folders/${FILE_ID}` });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatchObject({ code: "LINK_NOT_VALID", message: "Link is not valid" });
  });

  it("reports private files", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(driveResponse({ status: 302, headers: { location: "https://accounts.google.com/ServiceLogin" } })));
    const res = await as(USER_A).post("/api/resumes").send({ driveUrl: LINK });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatchObject({ code: "NOT_PUBLIC", message: "Not a public viewable resume" });
  });

  it("rejects files that are not PDF or DOCX", async () => {
    serveFile(Buffer.from("\x89PNG\r\n\x1a\n" + "x".repeat(500)), "image/png");
    const res = await as(USER_A).post("/api/resumes").send({ driveUrl: LINK });
    expect(res.body.error.code).toBe("LINK_NOT_VALID");
  });

  it("rejects an obvious non-resume without calling the LLM", async () => {
    serveFile(makePdf(INVOICE_LINES));
    const res = await as(USER_A).post("/api/resumes").send({ driveUrl: LINK });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatchObject({ code: "NOT_A_RESUME", message: "Please add resume link" });
    expect(chatJson).not.toHaveBeenCalled();
  });

  it("rejects when the classifier says it is not a resume", async () => {
    serveFile(makePdf(RESUME_LINES));
    aiAnswers({ isResume: false, confidence: 0.9 });
    const res = await as(USER_A).post("/api/resumes").send({ driveUrl: LINK });
    expect(res.body.error.code).toBe("NOT_A_RESUME");
  });

  it("rejects resumes the guard blocks", async () => {
    serveFile(makePdf(RESUME_LINES));
    guardCheck.mockResolvedValue({ verdict: "block", score: 0.97, reasons: ["prompt_guard"], sanitizedText: "" });
    const res = await as(USER_A).post("/api/resumes").send({ driveUrl: LINK });
    expect(res.status).toBe(422);
    expect(res.body.error).toMatchObject({ code: "RESUME_UNSAFE", message: "Resume contains disallowed content" });
  });

  it("ingests a public resume, then re-adding the same file replaces it", async () => {
    serveFile(makePdf(RESUME_LINES));
    const first = await as(USER_A).post("/api/resumes").send({ driveUrl: LINK });
    expect(first.status).toBe(201);
    expect(first.body.resume.fileName).toBe("Asha_CV.pdf");
    expect(first.body.resume.profile.projects.map((p) => p.name)).toEqual(["ShopLite", "ChatNow"]);
    const sentText = guardCheck.mock.calls[0][0];
    expect(sentText).toContain("ShopLite");

    const again = await as(USER_A).post("/api/resumes").send({ driveUrl: LINK });
    expect(again.status).toBe(201);
    expect(again.body.resume.id).toBe(first.body.resume.id);
  });
});

describe("reading, searching and deleting", () => {
  let resumeId;

  beforeEach(async () => {
    serveFile(makePdf(RESUME_LINES));
    const res = await as(USER_A).post("/api/resumes").send({ driveUrl: LINK });
    resumeId = res.body.resume.id;
  });

  it("lists and gets the owner's resumes", async () => {
    const list = await as(USER_A).get("/api/resumes");
    expect(list.body.items[0]).toMatchObject({ id: resumeId, name: "Asha Rao", projectNames: ["ShopLite", "ChatNow"] });
    const one = await as(USER_A).get(`/api/resumes/${resumeId}`);
    expect(one.body.resume.id).toBe(resumeId);
  });

  it("hides resumes from other users (404, not 403)", async () => {
    expect((await as(USER_B).get(`/api/resumes/${resumeId}`)).status).toBe(404);
    expect((await as(USER_B).get(`/internal/resumes/${resumeId}/profile`)).status).toBe(404);
    expect((await as(USER_B).post(`/internal/resumes/${resumeId}/search`).send({ query: "x" })).status).toBe(404);
    expect((await as(USER_B).del(`/api/resumes/${resumeId}`)).status).toBe(404);
    expect((await as(USER_B).get("/api/resumes")).body.items).toHaveLength(0);
  });

  it("returns 404 for malformed ids", async () => {
    expect((await as(USER_A).get("/api/resumes/not-a-uuid")).status).toBe(404);
  });

  it("serves the profile internally", async () => {
    const res = await as(USER_A).get(`/internal/resumes/${resumeId}/profile`);
    expect(res.body.profile.name).toBe("Asha Rao");
  });

  it("finds the right project chunk by vector similarity", async () => {
    const res = await as(USER_A)
      .post(`/internal/resumes/${resumeId}/search`)
      .send({ query: "ShopLite product pages cached in Redis", k: 2 });
    expect(res.status).toBe(200);
    expect(res.body.chunks[0].title).toBe("ShopLite");
    expect(res.body.chunks.length).toBeLessThanOrEqual(2);
  });

  it("deletes a resume", async () => {
    expect((await as(USER_A).del(`/api/resumes/${resumeId}`)).status).toBe(204);
    expect((await as(USER_A).get(`/api/resumes/${resumeId}`)).status).toBe(404);
  });
});

describe("search without embeddings", () => {
  it("falls back to full-text ranking", async () => {
    vi.resetModules();
    vi.doMock("../src/services/embedder.js", () => ({ embedTexts: async (texts) => texts.map(() => null) }));
    const { default: freshApp } = await import("../src/app.js");
    serveFile(makePdf(RESUME_LINES));
    const created = await request(freshApp)
      .post("/api/resumes")
      .set("x-internal-key", process.env.INTERNAL_API_KEY)
      .set("x-user-id", USER_A)
      .send({ driveUrl: `https://drive.google.com/file/d/${FILE_ID}XYZ/view` });
    expect(created.status).toBe(201);
    const res = await request(freshApp)
      .post(`/internal/resumes/${created.body.resume.id}/search`)
      .set("x-internal-key", process.env.INTERNAL_API_KEY)
      .set("x-user-id", USER_A)
      .send({ query: "websockets chat", k: 1 });
    expect(res.body.chunks[0].title).toBe("ChatNow");
  });
});

describe("internal auth", () => {
  it("rejects calls without the internal key", async () => {
    const res = await request(app).get("/api/resumes").set("x-user-id", USER_A);
    expect(res.status).toBe(401);
  });
});
