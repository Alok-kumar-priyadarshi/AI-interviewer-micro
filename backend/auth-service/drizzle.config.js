import { defineConfig } from "drizzle-kit";

// Migrations run from a developer machine with the Neon owner role (never on Vercel).
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.js",
  out: "./drizzle",
  schemaFilter: ["auth"],
  dbCredentials: { url: process.env.DATABASE_URL_MIGRATIONS ?? "" },
  // Each service keeps its own migration journal so services never skip each other's migrations.
  migrations: { schema: "auth", table: "__drizzle_migrations" },
});
