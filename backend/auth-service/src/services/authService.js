import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { env } from "../config/env.js";
import { db, isUniqueViolation } from "../db/client.js";
import { loginAttempts, refreshTokens, users } from "../db/schema.js";
import { AppError } from "../lib/AppError.js";
import { assertNotLocked, cleanupOccasionally, recordAttempt } from "./lockoutService.js";
import { issueSession, prepareSession } from "./tokenService.js";

const publicFields = {
  id: users.id,
  name: users.name,
  email: users.email,
  createdAt: users.createdAt,
};

const emailTaken = () =>
  new AppError("EMAIL_TAKEN", 409, "An account with this email already exists");
const invalidCredentials = () =>
  new AppError("INVALID_CREDENTIALS", 401, "Incorrect email or password");

// Compared against when the email is unknown, so both paths take the same time.
let dummyHash;
const getDummyHash = async () => (dummyHash ??= await bcrypt.hash("dummy-password-x1", env.BCRYPT_COST));

export async function signup({ name, email, password }, meta) {
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) throw emailTaken();

  const passwordHash = await bcrypt.hash(password, env.BCRYPT_COST);
  let user;
  try {
    [user] = await db.insert(users).values({ name, email, passwordHash }).returning(publicFields);
  } catch (err) {
    if (isUniqueViolation(err)) throw emailTaken();
    throw err;
  }
  const session = await issueSession(user.id, meta);
  return { user, ...session };
}

export async function login({ email, password }, meta) {
  // Lockout check and user lookup are independent: run them at the same time.
  const [, [found]] = await Promise.all([
    assertNotLocked(email),
    db.select().from(users).where(eq(users.email, email)).limit(1),
  ]);
  const ok = await bcrypt.compare(password, found?.passwordHash ?? (await getDummyHash()));
  if (!found || !ok) {
    await recordAttempt(email, meta.ip, false);
    throw invalidCredentials();
  }

  // Record the successful attempt and store the new session in one round trip.
  const { row, session } = await prepareSession(found.id, meta);
  await db.batch([
    db.insert(loginAttempts).values({ email, ip: meta.ip?.slice(0, 64) ?? null, succeeded: true }),
    db.insert(refreshTokens).values(row),
  ]);
  await cleanupOccasionally();
  const user = { id: found.id, name: found.name, email: found.email, createdAt: found.createdAt };
  return { user, ...session };
}

export async function getUser(userId) {
  const [user] = await db.select(publicFields).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new AppError("NOT_FOUND", 404, "Not found");
  return user;
}
