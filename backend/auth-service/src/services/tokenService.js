import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { SignJWT } from "jose";
import { env } from "../config/env.js";
import { db } from "../db/client.js";
import { refreshTokens } from "../db/schema.js";
import { AppError } from "../lib/AppError.js";

const accessKey = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
// A refresh used again within this window is treated as a benign multi-tab race, not theft.
const REUSE_GRACE_MS = 10_000;

const refreshInvalid = () => new AppError("REFRESH_INVALID", 401, "Please log in again");
const sessionRevoked = () => new AppError("SESSION_REVOKED", 401, "Please log in again");

export function signAccessToken(userId) {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(userId)
    .setIssuer("mi-auth")
    .setAudience("mi-api")
    .setIssuedAt()
    .setExpirationTime(env.ACCESS_TOKEN_TTL)
    .sign(accessKey);
}

/** Only an HMAC of the refresh token is stored, keyed with JWT_REFRESH_SECRET. */
export function hashRefreshToken(token) {
  return createHmac("sha256", env.JWT_REFRESH_SECRET).update(token).digest("hex");
}

function newRefreshRow(userId, familyId, userAgent) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000);
  return {
    token,
    row: {
      id: randomUUID(),
      userId,
      tokenHash: hashRefreshToken(token),
      familyId,
      expiresAt,
      userAgent: userAgent?.slice(0, 300) ?? null,
    },
  };
}

/**
 * Prepares a new token family (a login) without writing it, so the caller can store the row in
 * the same round trip as other writes. Returns { row, session }.
 */
export async function prepareSession(userId, { userAgent } = {}) {
  const { token, row } = newRefreshRow(userId, randomUUID(), userAgent);
  return {
    row,
    session: { accessToken: await signAccessToken(userId), refreshToken: token, refreshExpiresAt: row.expiresAt },
  };
}

/** Starts a new token family (a login) and stores it. */
export async function issueSession(userId, meta) {
  const { row, session } = await prepareSession(userId, meta);
  await db.insert(refreshTokens).values(row);
  return session;
}

export async function revokeFamily(familyId) {
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.familyId, familyId), isNull(refreshTokens.revokedAt)));
}

/**
 * Exchanges a refresh token for a new access token and a new refresh token in the same family.
 * A revoked token presented again (outside the grace window) revokes the whole family.
 */
export async function rotateSession(token, { userAgent } = {}) {
  if (!token) throw refreshInvalid();
  const next = newRefreshRow(null, null, userAgent);

  // One statement, one round trip: find the token, revoke it only if it is still valid (re-checked
  // on the live row, so two concurrent refreshes cannot both win), insert its replacement in the
  // same family, and return the user so the client doesn't need a separate /me call.
  const result = await db.execute(sql`
    with cur as (
      select id, user_id, family_id, revoked_at, expires_at
      from auth.refresh_tokens where token_hash = ${hashRefreshToken(token)}
    ), revoked as (
      update auth.refresh_tokens t set revoked_at = now(), replaced_by = ${next.row.id}
      from cur where t.id = cur.id and t.revoked_at is null and t.expires_at > now()
      returning t.user_id, t.family_id
    ), inserted as (
      insert into auth.refresh_tokens (id, user_id, token_hash, family_id, expires_at, user_agent)
      select ${next.row.id}, user_id, ${next.row.tokenHash}, family_id, ${next.row.expiresAt.toISOString()}, ${next.row.userAgent}
      from revoked
      returning user_id
    )
    select cur.family_id, cur.revoked_at is not null as was_revoked,
           coalesce(extract(epoch from now() - cur.revoked_at) * 1000, 0)::float8 as revoked_ms_ago,
           (select count(*) from inserted)::int as rotated,
           u.id as user_id, u.name, u.email, u.created_at
    from cur join auth.users u on u.id = cur.user_id
  `);
  const row = result.rows?.[0];
  if (!row) throw refreshInvalid();

  if (!row.rotated) {
    if (row.was_revoked && Number(row.revoked_ms_ago) >= REUSE_GRACE_MS) {
      await revokeFamily(row.family_id);
      throw sessionRevoked();
    }
    throw refreshInvalid(); // expired, or a concurrent refresh / another tab rotated it first
  }

  return {
    user: { id: row.user_id, name: row.name, email: row.email, createdAt: new Date(row.created_at) },
    accessToken: await signAccessToken(row.user_id),
    refreshToken: next.token,
    refreshExpiresAt: next.row.expiresAt,
  };
}

/** Logout: revokes the family of the presented token, if it exists. */
export async function endSession(token) {
  if (!token) return;
  const [current] = await db
    .select({ familyId: refreshTokens.familyId })
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, hashRefreshToken(token)))
    .limit(1);
  if (current) await revokeFamily(current.familyId);
}
