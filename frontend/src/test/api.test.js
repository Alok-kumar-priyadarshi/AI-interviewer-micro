import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "../api/client.js";
import { readNdjson } from "../api/resources.js";
import { useAuthStore } from "../store/authStore.js";
import { errorMessage, fieldErrors } from "../utils/errorMessages.js";

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => useAuthStore.setState({ user: null, accessToken: "old-token", status: "authenticated" }));
afterEach(() => vi.unstubAllGlobals());

describe("readNdjson", () => {
  it("parses events split across chunk boundaries", async () => {
    const encoder = new TextEncoder();
    const parts = ['{"type":"start"}\n{"type":"del', 'ta","text":"Hi"}\n', '{"type":"done","turnId":"t1"}'];
    const body = new ReadableStream({
      start(controller) {
        parts.forEach((p) => controller.enqueue(encoder.encode(p)));
        controller.close();
      },
    });
    const events = [];
    await readNdjson(body, (e) => events.push(e));
    expect(events).toEqual([{ type: "start" }, { type: "delta", text: "Hi" }, { type: "done", turnId: "t1" }]);
  });
});

describe("api client", () => {
  it("sends the bearer token and returns JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, { items: [] }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(api.get("/resumes")).resolves.toEqual({ items: [] });
    expect(fetchMock.mock.calls[0][1].headers.authorization).toBe("Bearer old-token");
  });

  it("refreshes once on TOKEN_EXPIRED and retries with the new token", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(401, { error: { code: "TOKEN_EXPIRED" } }))
      .mockResolvedValueOnce(json(200, { accessToken: "new-token" }))
      .mockResolvedValueOnce(json(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(api.get("/resumes")).resolves.toEqual({ ok: true });
    expect(fetchMock.mock.calls[1][0]).toBe("/api/auth/refresh");
    expect(fetchMock.mock.calls[2][1].headers.authorization).toBe("Bearer new-token");
    expect(useAuthStore.getState().accessToken).toBe("new-token");
  });

  it("shares one refresh between parallel requests", async () => {
    let refreshCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url, init) => {
        if (url === "/api/auth/refresh") {
          refreshCalls += 1;
          return json(200, { accessToken: "new-token" });
        }
        return init.headers.authorization === "Bearer new-token" ? json(200, { ok: true }) : json(401, { error: { code: "TOKEN_EXPIRED" } });
      }),
    );
    await Promise.all([api.get("/a"), api.get("/b"), api.get("/c")]);
    expect(refreshCalls).toBe(1);
  });

  it("logs the user out when the refresh fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(json(401, { error: { code: "TOKEN_EXPIRED" } }))
        .mockResolvedValueOnce(json(401, { error: { code: "SESSION_REVOKED" } })),
    );
    await expect(api.get("/resumes")).rejects.toBeInstanceOf(ApiError);
    expect(useAuthStore.getState().status).toBe("anonymous");
  });

  it("turns error bodies into ApiError with code and details", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(403, { error: { code: "NOT_PUBLIC", message: "Not a public viewable resume" } })));
    await expect(api.post("/resumes", { driveUrl: "x" })).rejects.toMatchObject({ status: 403, code: "NOT_PUBLIC" });
  });

  it("reports network failures clearly", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(api.get("/x")).rejects.toMatchObject({ code: "NETWORK_ERROR" });
  });
});

describe("error messages", () => {
  it("uses the exact resume link messages", () => {
    expect(errorMessage({ code: "INVALID_URL" })).toBe("Not a valid URL");
    expect(errorMessage({ code: "NOT_PUBLIC" })).toBe("Not a public viewable resume");
    expect(errorMessage({ code: "LINK_NOT_VALID" })).toBe("Link is not valid");
    expect(errorMessage({ code: "NOT_A_RESUME" })).toBe("Please add resume link");
  });

  it("maps validation details to fields", () => {
    expect(fieldErrors({ details: [{ path: "email", message: "Enter a valid email address" }] })).toEqual({
      email: "Enter a valid email address",
    });
  });
});
