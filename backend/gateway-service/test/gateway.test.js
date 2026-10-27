import express from "express";
import { SignJWT } from "jose";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const USER_ID = "3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90";
const key = () => new TextEncoder().encode(process.env.JWT_ACCESS_SECRET);

function token({ sub = USER_ID, exp = "15m" } = {}) {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sub)
    .setIssuer("mi-auth")
    .setAudience("mi-api")
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(key());
}

let upstream;
let app;
const seen = [];

beforeAll(async () => {
  const fake = express();
  fake.use(express.json());
  fake.all("/{*splat}", (req, res) => {
    seen.push({ method: req.method, url: req.originalUrl, headers: req.headers, body: req.body });
    if (req.originalUrl === "/api/auth/login") {
      res.setHeader("set-cookie", "mi_rt=abc; Path=/api/auth; HttpOnly");
      return res.json({ ok: true });
    }
    if (req.originalUrl.endsWith("/next")) {
      res.setHeader("content-type", "application/x-ndjson");
      res.write('{"type":"start"}\n');
      res.write('{"type":"done"}\n');
      return res.end();
    }
    res.status(201).json({ echoed: true });
  });
  await new Promise((resolve) => {
    upstream = fake.listen(0, resolve);
  });
  const base = `http://127.0.0.1:${upstream.address().port}`;
  for (const name of ["AUTH", "RESUME", "INTERVIEW", "SPEECH", "REPORT"]) {
    process.env[`${name}_SERVICE_URL`] = base;
  }
  ({ default: app } = await import("../src/app.js"));
});

afterAll(() => upstream?.close());

describe("gateway", () => {
  it("answers health checks", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.service).toBe("gateway-service");
  });

  it("rejects protected routes without a token", async () => {
    const res = await request(app).get("/api/resumes");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("TOKEN_INVALID");
  });

  it("reports expired tokens distinctly so the client can refresh", async () => {
    const expired = await token({ exp: Math.floor(Date.now() / 1000) - 10 });
    const res = await request(app).get("/api/resumes").set("authorization", `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("TOKEN_EXPIRED");
  });

  it("forwards with x-user-id and the internal key, ignoring spoofed headers", async () => {
    const res = await request(app)
      .post("/api/resumes?x=1")
      .set("authorization", `Bearer ${await token()}`)
      .set("x-user-id", "00000000-0000-4000-8000-000000000000")
      .set("x-internal-key", "spoofed")
      .send({ driveUrl: "https://drive.google.com/file/d/abc/view" });
    expect(res.status).toBe(201);
    const last = seen.at(-1);
    expect(last.url).toBe("/api/resumes?x=1");
    expect(last.headers["x-user-id"]).toBe(USER_ID);
    expect(last.headers["x-internal-key"]).toBe(process.env.INTERNAL_API_KEY);
    expect(last.headers.authorization).toBeUndefined();
    expect(last.body.driveUrl).toContain("drive.google.com");
  });

  it("lets public auth routes through and passes cookies both ways", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("cookie", "mi_rt=old")
      .send({ email: "a@b.co", password: "x" });
    expect(res.status).toBe(200);
    expect(res.headers["set-cookie"][0]).toContain("mi_rt=abc");
    const last = seen.at(-1);
    expect(last.headers.cookie).toBe("mi_rt=old");
    expect(last.headers["x-user-id"]).toBeUndefined();
  });

  it("requires a token for /api/auth/me", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("never forwards cookies to non-auth services", async () => {
    await request(app)
      .get("/api/reports")
      .set("authorization", `Bearer ${await token()}`)
      .set("cookie", "mi_rt=secret");
    expect(seen.at(-1).headers.cookie).toBeUndefined();
  });

  it("streams NDJSON responses through", async () => {
    const res = await request(app)
      .post("/api/interviews/abc/next")
      .set("authorization", `Bearer ${await token()}`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("application/x-ndjson");
    expect(res.text.trim().split("\n")).toHaveLength(2);
  });

  it("rides out a service restart by retrying refused connections", async () => {
    const port = upstream.address().port;
    const app2 = upstream.listeners("request")[0];
    await new Promise((resolve) => upstream.close(resolve));
    // Service comes back 600 ms later, while the gateway is retrying.
    setTimeout(() => {
      upstream = app2.listen(port);
    }, 600);
    const res = await request(app)
      .post("/api/resumes")
      .set("authorization", `Bearer ${await token()}`)
      .send({ driveUrl: "x" });
    expect(res.status).toBe(201);
    expect(seen.filter((s) => s.method === "POST" && s.url === "/api/resumes").length).toBeGreaterThan(0);
  });

  it("maps an unreachable upstream to 502", async () => {
    const saved = process.env.RESUME_SERVICE_URL;
    upstream.close();
    const res = await request(app).get("/api/resumes").set("authorization", `Bearer ${await token()}`);
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe("UPSTREAM_UNAVAILABLE");
    process.env.RESUME_SERVICE_URL = saved;
  });
});
