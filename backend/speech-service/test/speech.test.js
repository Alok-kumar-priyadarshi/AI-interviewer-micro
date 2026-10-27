import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.fn();

vi.mock("../src/clients/groq.js", async () => {
  const { AppError } = await import("../src/lib/AppError.js");
  return {
    getGroq: () => ({ audio: { transcriptions: { create } } }),
    withRetry: (fn) => fn(),
    aiBusy: () => new AppError("AI_BUSY", 503, "busy"),
  };
});

const { default: app } = await import("../src/app.js");

const USER = "3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90";
const webm = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(200, 1)]);

const post = () =>
  request(app)
    .post("/api/speech/transcribe")
    .set("x-internal-key", process.env.INTERNAL_API_KEY)
    .set("x-user-id", USER);

beforeEach(() => {
  create.mockReset();
  create.mockImplementation(async () => {
    throw new Error("no mock response configured");
  });
});

describe("speech-service", () => {
  it("transcribes a webm recording and passes the vocabulary hint", async () => {
    create.mockResolvedValue({ text: "  I used Kubernetes for deployment. ", duration: 12.345 });
    const res = await post()
      .field("hint", "Kubernetes, PostgreSQL")
      .attach("audio", webm, { filename: "a.webm", contentType: "audio/webm;codecs=opus" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ text: "I used Kubernetes for deployment.", durationSec: 12.3 });
    const params = create.mock.calls[0][0];
    expect(params.model).toBe("whisper-large-v3-turbo");
    expect(params.prompt).toBe("Kubernetes, PostgreSQL");
    expect(params.language).toBe("en");
  });

  it("falls back to the second Whisper model", async () => {
    create.mockRejectedValueOnce(Object.assign(new Error("gone"), { status: 404 }));
    create.mockResolvedValueOnce({ text: "hello", duration: 1 });
    const res = await post().attach("audio", webm, { filename: "a.webm", contentType: "audio/webm" });
    expect(res.status).toBe(200);
    expect(create.mock.calls[1][0].model).toBe("whisper-large-v3");
  });

  it("returns AI_BUSY when both models fail", async () => {
    create.mockImplementation(async () => {
      throw Object.assign(new Error("rate"), { status: 429 });
    });
    const res = await post().attach("audio", webm, { filename: "a.webm", contentType: "audio/webm" });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("AI_BUSY");
  });

  it("rejects an empty transcript", async () => {
    create.mockResolvedValue({ text: "   ", duration: 3 });
    const res = await post().attach("audio", webm, { filename: "a.webm", contentType: "audio/webm" });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("EMPTY_TRANSCRIPT");
  });

  it("rejects files whose bytes do not match the declared audio type", async () => {
    const res = await post().attach("audio", Buffer.from("%PDF-1.7 not audio at all"), {
      filename: "a.webm",
      contentType: "audio/webm",
    });
    expect(res.status).toBe(415);
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects non-audio MIME types", async () => {
    const res = await post().attach("audio", webm, { filename: "a.txt", contentType: "text/plain" });
    expect(res.status).toBe(415);
  });

  it("rejects recordings over the size limit", async () => {
    const big = Buffer.concat([webm, Buffer.alloc(1.2 * 1024 * 1024)]);
    const res = await post().attach("audio", big, { filename: "a.webm", contentType: "audio/webm" });
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("AUDIO_TOO_LARGE");
  });

  it("requires a user", async () => {
    const res = await request(app)
      .post("/api/speech/transcribe")
      .set("x-internal-key", process.env.INTERNAL_API_KEY)
      .attach("audio", webm, { filename: "a.webm", contentType: "audio/webm" });
    expect(res.status).toBe(401);
  });
});
