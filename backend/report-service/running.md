# report-service: running guide

Builds and stores the final report for each interview. It computes scores and progress comparison in code, has Groq write the narrative, and stores every question and answer (with voice/text mode and raw transcript) in `report.report_items`. Owns the `report` schema. Design: [docs/04-services.md](../../docs/04-services.md#report-service-port-4005).

## Install / configure
```bash
npm install
cp .env.example .env
```

| Key | Where to get it |
|---|---|
| `DATABASE_URL` | Neon → branch `dev` → role **report_svc** → pooled string |
| `DATABASE_URL_MIGRATIONS` | Neon owner role (local only) |
| `GROQ_API_KEY` | console.groq.com |
| `INTERNAL_API_KEY` | Same value in all backend services |

## Database
```bash
npm run db:migrate
```

## Run
```bash
npm run dev               # http://localhost:4005
```

## Try it
```bash
curl http://localhost:4005/api/reports -H "x-internal-key: <KEY>" -H "x-user-id: <user id>"
curl http://localhost:4005/api/reports/by-session/<session id> -H "x-internal-key: <KEY>" -H "x-user-id: <user id>"
```
Reports are created by interview-service (`POST /internal/reports`) when an interview ends. Creation is idempotent per interview.

## Test and lint
```bash
npm test
npm run lint
```

## Deploy to Vercel
Root Directory `backend/report-service`, Node 24, env vars from `.env.example` (no `PORT`/`DATABASE_URL_MIGRATIONS`), Neon **main**, `npm run db:migrate` once, Max Duration 60 s.

## Troubleshooting
| Symptom | Fix |
|---|---|
| `503 AI_BUSY` when ending an interview | Groq limit reached. The interview stays completed; use "Generate report" on the dashboard later |
| Progress section missing | It appears from the second completed interview onwards |

## Versions (pinned at scaffold, 2026-10-26)
express 5.3.0 · groq-sdk 1.6.0 · drizzle-orm 0.45.4 · @neondatabase/serverless 1.2.0 · zod 4.6.7
