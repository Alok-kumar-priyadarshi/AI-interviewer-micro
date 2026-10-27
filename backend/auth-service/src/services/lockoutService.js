import { lt, or, sql } from "drizzle-orm";
import { env } from "../config/env.js";
import { db } from "../db/client.js";
import { loginAttempts, refreshTokens } from "../db/schema.js";
import { AppError } from "../lib/AppError.js";
import { logger } from "../lib/logger.js";

/**
 * Throws ACCOUNT_LOCKED when the email has LOGIN_MAX_ATTEMPTS failures inside the lock window
 * since its last successful login.
 */
export async function assertNotLocked(email) {
  const result = await db.execute(sql`
    select count(*)::int as failures
    from ${loginAttempts}
    where ${loginAttempts.email} = ${email}
      and ${loginAttempts.succeeded} = false
      and ${loginAttempts.createdAt} > greatest(
        now() - make_interval(mins => ${env.LOGIN_LOCK_MINUTES}),
        coalesce(
          (select max(created_at) from ${loginAttempts}
           where ${loginAttempts.email} = ${email} and ${loginAttempts.succeeded} = true),
          '-infinity'::timestamptz
        )
      )
  `);
  const failures = result.rows?.[0]?.failures ?? 0;
  if (failures >= env.LOGIN_MAX_ATTEMPTS) {
    throw new AppError(
      "ACCOUNT_LOCKED",
      429,
      `Too many attempts. Try again in ${env.LOGIN_LOCK_MINUTES} minutes`,
    );
  }
}

export async function recordAttempt(email, ip, succeeded) {
  await db.insert(loginAttempts).values({ email, ip: ip?.slice(0, 64) ?? null, succeeded });
}

/** Deletes old attempts and dead refresh tokens. Runs occasionally during login (no cron needed). */
export async function cleanupOccasionally() {
  if (Math.random() > 0.05) return;
  try {
    const monthAgo = new Date(Date.now() - 30 * 86_400_000);
    const dayAgo = new Date(Date.now() - 86_400_000);
    await db.batch([
      db.delete(loginAttempts).where(lt(loginAttempts.createdAt, monthAgo)),
      db
        .delete(refreshTokens)
        .where(or(lt(refreshTokens.expiresAt, dayAgo), lt(refreshTokens.revokedAt, monthAgo))),
    ]);
  } catch (err) {
    logger.warn("cleanup_failed", { err: err?.message });
  }
}
