// Applies the SQL migrations in ./drizzle over Neon's HTTP driver and always reports the result.
// drizzle-kit is still used to *generate* migrations; its `migrate` CLI sometimes exits silently
// with this driver, so applying them is done here. Same journal table as drizzle-kit
// (<schema>.__drizzle_migrations), and each migration runs in one transaction: all or nothing.
import path from "node:path";
import { pathToFileURL } from "node:url";
import { neon } from "@neondatabase/serverless";
import { readMigrationFiles } from "drizzle-orm/migrator";

const SCHEMA = "resume";
const TABLE = "__drizzle_migrations";

export async function runMigrations({ url, folder, schema = SCHEMA }) {
  const sql = neon(url);
  const journal = `"${schema}"."${TABLE}"`;
  await sql.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
  await sql.query(`CREATE TABLE IF NOT EXISTS ${journal} (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`);

  const [last] = await sql.query(`SELECT created_at FROM ${journal} ORDER BY created_at DESC LIMIT 1`);
  const lastApplied = last ? Number(last.created_at) : -1;
  const pending = readMigrationFiles({ migrationsFolder: folder }).filter((m) => m.folderMillis > lastApplied);

  for (const migration of pending) {
    await sql.transaction([
      ...migration.sql.filter((statement) => statement.trim()).map((statement) => sql.query(statement)),
      sql.query(`INSERT INTO ${journal} (hash, created_at) VALUES ($1, $2)`, [migration.hash, migration.folderMillis]),
    ]);
  }

  const [{ total }] = await sql.query(`SELECT count(*)::int AS total FROM ${journal}`);
  return { applied: pending.length, total };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const url = process.env.DATABASE_URL_MIGRATIONS;
  if (!url) {
    process.stderr.write("DATABASE_URL_MIGRATIONS is not set. Add the Neon owner connection string to .env.\n");
    process.exit(1);
  }
  try {
    const folder = path.resolve(import.meta.dirname, "../../drizzle");
    const { applied, total } = await runMigrations({ url, folder });
    process.stdout.write(
      applied
        ? `✓ Applied ${applied} migration(s) to schema "${SCHEMA}" (${total} applied in total).\n`
        : `✓ Schema "${SCHEMA}" is up to date (${total} migration(s) applied, nothing new).\n`,
    );
  } catch (err) {
    process.stderr.write(`✗ Migration failed, nothing from the failing migration was applied: ${err.message}\n`);
    process.exit(1);
  }
}
