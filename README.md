# AI Mock Interviewer

Practise technical interviews with an AI interviewer that reads your resume from a public Google Drive link. It asks questions about your real projects and skills at low, medium or high difficulty, and accepts spoken or typed answers. At the end you get a detailed report: scores, every question and answer, what an ideal answer covers, and your progress over time.

Built as **7 Express microservices + a React frontend**, all on free tiers: Vercel (hosting), Neon (Postgres + pgvector) and Groq (LLMs, Whisper, Prompt Guard).

# DEPLOYED LIVE LINK
[Click Here](https://frontend-nine-ecru-6j45hz9ns2.vercel.app/)

## Repository

```
backend/
  gateway-service/    :4000  public entry: JWT check + routing
  auth-service/       :4001  signup, login, refresh-token rotation
  resume-service/     :4002  Drive link → validated, parsed, profiled, RAG-indexed resume
  interview-service/  :4003  plan, streamed questions, grading, follow-ups
  speech-service/     :4004  speech-to-text (Groq Whisper)
  report-service/     :4005  final report, scoring, progress
  guard-service/      :4006  prompt-injection detection
frontend/             :5173  React app
docs/                        design docs + Mermaid diagrams
scripts/                     db-setup.sql, dev-all.ps1
```

Each app has its own `.env`, `.env.example` and `running.md`.

## Quick start (local)

1. **Accounts (free):** [Neon](https://neon.tech), [Groq](https://console.groq.com).
2. **Database:** run [`scripts/db-setup.sql`](scripts/db-setup.sql) in the Neon SQL editor (set the passwords first), then create a `dev` branch.
3. **Env files:** each app already has a local `.env` with generated shared secrets. Fill in, per service:
    - `DATABASE_URL` and `DATABASE_URL_MIGRATIONS` (auth, resume, interview, report): Neon connection strings
    - `GROQ_API_KEY` (resume, interview, speech, report, guard)
4. **Install and migrate:**
   ```powershell
   foreach ($d in Get-ChildItem backend -Directory) { Push-Location $d.FullName; npm install; Pop-Location }
   Push-Location frontend; npm install; Pop-Location
   foreach ($s in "auth","resume","interview","report") { Push-Location "backend\$s-service"; npm run db:migrate; Pop-Location }
   ```
5. **Run everything:** `powershell -ExecutionPolicy Bypass -File scripts\dev-all.ps1`, then open http://localhost:5173

## Tests

Every service has `npm test` (Vitest) and `npm run lint`. Database tests run against an in-memory Postgres (PGlite) with the real migrations. Groq, Google Drive and other services are mocked.

| App | Tests |
|---|---|
| gateway | 9 |
| auth | 12 |
| guard | 24 |
| speech | 8 |
| resume | 47 |
| interview | 27 |
| report | 11 |
| frontend | 15 |

## Deploy

See [docs/13-deployment.md](docs/13-deployment.md): 8 Vercel projects from this repo (one Root Directory each), Neon `main` branch, one Groq key.

## Docs

Start at [docs/README.md](docs/README.md): architecture, data flows, database, API contracts, security, AI design, and the build plan.
