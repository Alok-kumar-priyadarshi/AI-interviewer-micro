# interview-service: running guide

Runs the live interview. It builds a plan from the resume profile, streams each question (NDJSON), screens and grades each answer, decides follow-ups by difficulty level, stores every turn, and at the end sends the full transcript to report-service. Owns the `interview` schema. Design: [docs/04-services.md](../../docs/04-services.md#interview-service-port-4003).

## Prerequisites
- Node.js 24, Neon set up, a Groq key
- resume-service, guard-service and report-service running

## Install / configure
```bash
npm install
cp .env.example .env
```

| Key | Where to get it |
|---|---|
| `DATABASE_URL` | Neon → branch `dev` → role **interview_svc** → pooled string |
| `DATABASE_URL_MIGRATIONS` | Neon owner role (local only) |
| `GROQ_API_KEY` | console.groq.com |
| `GROQ_MODEL_MAIN` / `GROQ_MODEL_FAST` | Defaults `openai/gpt-oss-120b` / `openai/gpt-oss-20b`. Change here if Groq retires a model |
| `RESUME_SERVICE_URL`, `GUARD_SERVICE_URL`, `REPORT_SERVICE_URL` | Local defaults, or deployed URLs |
| `INTERNAL_API_KEY` | Same value in all backend services |

## Database
```bash
npm run db:migrate
```

## Run
```bash
npm run dev               # http://localhost:4003
```

## Try it
```bash
KEY=<INTERNAL_API_KEY>; USER=<user id>; RESUME=<resume id owned by USER>
curl -X POST http://localhost:4003/api/interviews -H "x-internal-key: $KEY" -H "x-user-id: $USER" \
  -H "content-type: application/json" -d "{\"resumeId\":\"$RESUME\",\"level\":\"medium\",\"questionCount\":5}"
curl -N -X POST http://localhost:4003/api/interviews/<session id>/next -H "x-internal-key: $KEY" -H "x-user-id: $USER"
```
The question streams as lines of JSON: `start`, `delta`…, optionally `replace`, then `done` with the `turnId`.

## Test and lint
```bash
npm test                  # PGlite + mocked Groq and services; covers the full flow
npm run lint
```

## Deploy to Vercel
1. Root Directory `backend/interview-service`, Node 24.
2. Env vars from `.env.example` (no `PORT`/`DATABASE_URL_MIGRATIONS`), `NODE_ENV=production`, Neon **main**.
3. `npm run db:migrate` once against **main**.
4. Max Duration 60 s (`/end` waits for the report).

## Troubleshooting
| Symptom | Fix |
|---|---|
| `503 AI_BUSY` | Groq rate limit or outage. Retry in a minute; check Groq console → Limits |
| Questions ignore the resume | resume-service search failing (see its logs); interviews continue without RAG context |
| `404` on create | The resume does not belong to that user, or resume-service is down |

## Versions (pinned at scaffold, 2026-10-26)
express 5.3.0 · groq-sdk 1.6.0 · drizzle-orm 0.45.4 · @neondatabase/serverless 1.2.0 · zod 4.6.7
