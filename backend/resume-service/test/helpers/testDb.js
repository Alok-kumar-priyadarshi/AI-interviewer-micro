import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../../src/db/schema.js";

/** In-memory Postgres with pgvector and this service's real migrations. */
export async function createTestDb() {
  const client = new PGlite({ extensions: { vector } });
  await client.exec("CREATE EXTENSION IF NOT EXISTS vector;");
  const dir = path.resolve(import.meta.dirname, "../../drizzle");
  const files = fs.readdirSync(dir).filter((file) => file.endsWith(".sql")).sort();
  for (const file of files) {
    const statements = fs.readFileSync(path.join(dir, file), "utf8").split("--> statement-breakpoint");
    for (const statement of statements) if (statement.trim()) await client.exec(statement);
  }
  const db = drizzle({ client, schema });
  db.batch = async (queries) => {
    const results = [];
    for (const query of queries) results.push(await query);
    return results;
  };
  return { db, client };
}

export const isUniqueViolation = (err) => (err?.code ?? err?.cause?.code) === "23505";
