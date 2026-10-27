# auth-service: running guide

Signup, login, refresh-token rotation (with reuse detection), logout, and a login lockout after repeated failures. Owns the `auth` schema in Neon. Design: [docs/04-services.md](../../docs/04-services.md#auth-service-port-4001).

## Prerequisites
- Node.js 24
- Neon set up with `scripts/db-setup.sql` (see [docs/13-deployment.md](../../docs/13-deployment.md#2-neon))

## Install
```bash
npm install
```

## Configure
```bash
cp .env.example .env
```

| Key | Where to get it |
|---|---|
| `DATABASE_URL` | Neon → branch `dev` → role **auth_svc** → pooled connection string |
| `DATABASE_URL_MIGRATIONS` | Neon → branch `dev` → role **neondb_owner** (local only, never on Vercel) |
| `JWT_ACCESS_SECRET` | Random 48 bytes; **same value as gateway-service** |
| `JWT_REFRESH_SECRET` | Random 48 bytes; different from the access secret |
| `INTERNAL_API_KEY` | Same value in all backend services |

## Database
```bash
npm run db:migrate        # applies drizzle/*.sql (owner URL); prints "✓ Applied N" or "✓ … up to date"
```
After changing `src/db/schema.js`: `npm run db:generate`, review the new file in `drizzle/`, then migrate.

## Run
```bash
npm run dev               # http://localhost:4001
curl http://localhost:4001/health
```

## Try it (directly, with the internal key)
```bash
KEY=<your INTERNAL_API_KEY>
curl -X POST http://localhost:4001/api/auth/signup -H "x-internal-key: $KEY" \
  -H "content-type: application/json" -d '{"name":"Asha","email":"asha@example.com","password":"secret123"}' -i
curl -X POST http://localhost:4001/api/auth/login -H "x-internal-key: $KEY" \
  -H "content-type: application/json" -d '{"email":"asha@example.com","password":"secret123"}' -i
```
The response sets the `mi_rt` cookie (httpOnly, SameSite=Strict, Path=/api/auth) and returns `{ user, accessToken }`.

## Test and lint
```bash
npm test                  # runs against an in-memory Postgres (PGlite) with the real migrations
npm run lint
```

## Deploy to Vercel
1. Root Directory `backend/auth-service`, Node 24.
2. Env vars: `.env.example` keys except `PORT` and `DATABASE_URL_MIGRATIONS`; `NODE_ENV=production`; `DATABASE_URL` from Neon branch **main**.
3. Run `npm run db:migrate` once against **main** (owner URL) from your machine.
4. Ignored Build Step: `git diff --quiet HEAD^ HEAD -- .`

## Troubleshooting
| Symptom | Fix |
|---|---|
| `permission denied for schema auth` | `scripts/db-setup.sql` was not run, or `DATABASE_URL` uses the wrong role |
| Migrations fail with "schema already exists" | Pull the latest `drizzle/0000_init.sql` (it uses `IF NOT EXISTS`) |
| `429 ACCOUNT_LOCKED` while testing | 5 failed logins in 15 min; wait, or delete rows from `auth.login_attempts` on the dev branch |

## Versions (pinned at scaffold, 2026-10-26)
express 5.3.0 · bcryptjs 3.0.3 · jose 6.2.13 · cookie-parser 1.4.7 · drizzle-orm 0.45.4 · drizzle-kit 0.31.11 · @neondatabase/serverless 1.2.0 · zod 4.6.7
