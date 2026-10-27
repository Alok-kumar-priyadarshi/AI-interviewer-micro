import { isNotNull } from "drizzle-orm";
import { jwtVerify } from "jose";
import request from "supertest";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../src/db/client.js", async () => {
  const { createTestDb, isUniqueViolation } = await import("./helpers/testDb.js");
  const { db } = await createTestDb();
  return { db, isUniqueViolation };
});

const { default: app } = await import("../src/app.js");
const { db } = await import("../src/db/client.js");
const { refreshTokens } = await import("../src/db/schema.js");

const KEY = process.env.INTERNAL_API_KEY;
const api = {
  post: (path) => request(app).post(path).set("x-internal-key", KEY),
  get: (path) => request(app).get(path).set("x-internal-key", KEY),
};

const cookieOf = (res) => res.headers["set-cookie"]?.find((c) => c.startsWith("mi_rt="));
const tokenOf = (res) => cookieOf(res)?.split(";")[0];

describe("auth-service", () => {
  let signupRes;

  beforeAll(async () => {
    signupRes = await api
      .post("/api/auth/signup")
      .send({ name: "Asha", email: "  Asha@Example.com ", password: "secret123" });
  });

  it("serves health without the internal key", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
  });

  it("rejects calls without the internal key", async () => {
    const res = await request(app).post("/api/auth/login").send({});
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED_INTERNAL");
  });

  it("signs up, normalizes the email and sets a strict httpOnly refresh cookie", async () => {
    expect(signupRes.status).toBe(201);
    expect(signupRes.body.user.email).toBe("asha@example.com");
    expect(signupRes.body.user.passwordHash).toBeUndefined();
    const cookie = cookieOf(signupRes);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(cookie).toMatch(/Path=\/api\/auth/);
    const { payload } = await jwtVerify(
      signupRes.body.accessToken,
      new TextEncoder().encode(process.env.JWT_ACCESS_SECRET),
      { issuer: "mi-auth", audience: "mi-api" },
    );
    expect(payload.sub).toBe(signupRes.body.user.id);
  });

  it("refuses a duplicate email", async () => {
    const res = await api
      .post("/api/auth/signup")
      .send({ name: "Other", email: "asha@example.com", password: "secret123" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_TAKEN");
  });

  it("validates password strength", async () => {
    const res = await api
      .post("/api/auth/signup")
      .send({ name: "Weak", email: "weak@example.com", password: "short" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details.map((d) => d.path)).toContain("password");
  });

  it("uses one error for unknown email and wrong password", async () => {
    const wrongPassword = await api.post("/api/auth/login").send({ email: "asha@example.com", password: "nope0000" });
    const unknownEmail = await api.post("/api/auth/login").send({ email: "ghost@example.com", password: "nope0000" });
    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.error.code).toBe("INVALID_CREDENTIALS");
    expect(unknownEmail.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("locks an email after 5 failures within the window", async () => {
    const email = "locked@example.com";
    await api.post("/api/auth/signup").send({ name: "L", email, password: "secret123" });
    for (let i = 0; i < 5; i += 1) {
      await api.post("/api/auth/login").send({ email, password: "wrong000" });
    }
    const res = await api.post("/api/auth/login").send({ email, password: "secret123" });
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe("ACCOUNT_LOCKED");
  });

  it("logs in and returns the user", async () => {
    const res = await api.post("/api/auth/login").send({ email: "asha@example.com", password: "secret123" });
    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe("Asha");
    expect(tokenOf(res)).toBeTruthy();
  });

  it("rotates refresh tokens and revokes the family when an old one is replayed", async () => {
    const login = await api.post("/api/auth/login").send({ email: "asha@example.com", password: "secret123" });
    const first = tokenOf(login);

    const rotated = await api.post("/api/auth/refresh").set("cookie", first);
    expect(rotated.status).toBe(200);
    expect(rotated.body.accessToken).toBeTruthy();
    expect(rotated.body.user).toMatchObject({ name: "Asha", email: "asha@example.com" });
    const second = tokenOf(rotated);
    expect(second).not.toBe(first);

    // Within the grace window a replay is a benign race: rejected, family kept.
    const race = await api.post("/api/auth/refresh").set("cookie", first);
    expect(race.body.error.code).toBe("REFRESH_INVALID");

    // Push the revocation into the past so the replay counts as theft.
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date(Date.now() - 60_000) })
      .where(isNotNull(refreshTokens.revokedAt));
    const replay = await api.post("/api/auth/refresh").set("cookie", first);
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe("SESSION_REVOKED");

    const afterTheft = await api.post("/api/auth/refresh").set("cookie", second);
    expect(afterTheft.status).toBe(401);
  });

  it("logout revokes the session", async () => {
    const login = await api.post("/api/auth/login").send({ email: "asha@example.com", password: "secret123" });
    const cookie = tokenOf(login);
    const out = await api.post("/api/auth/logout").set("cookie", cookie);
    expect(out.status).toBe(204);
    const res = await api.post("/api/auth/refresh").set("cookie", cookie);
    expect(res.status).toBe(401);
  });

  it("returns the current user for /me with x-user-id", async () => {
    const res = await api.get("/api/auth/me").set("x-user-id", signupRes.body.user.id);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("asha@example.com");
  });

  it("requires x-user-id for /me", async () => {
    const res = await api.get("/api/auth/me");
    expect(res.status).toBe(401);
  });
});
