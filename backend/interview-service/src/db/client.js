import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { env } from "../config/env.js";
import * as schema from "./schema.js";

// HTTP driver: one request per query, no connection pool to exhaust on serverless.
export const db = drizzle({ client: neon(env.DATABASE_URL), schema });

/** Postgres unique violation, unwrapping drizzle's query error wrapper. */
export function isUniqueViolation(err) {
  return (err?.code ?? err?.cause?.code) === "23505";
}
