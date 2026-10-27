# resume-service: running guide

Validates a Google Drive link, downloads the file as an anonymous visitor would, extracts text (PDF/DOCX), screens it for prompt injection, checks it really is a resume, extracts a structured profile with Groq, and indexes section chunks for RAG (pgvector). Owns the `resume` schema. Design: [docs/04-services.md](../../docs/04-services.md#resume-service-port-4002).

## Prerequisites
- Node.js 24
- Neon set up (`scripts/db-setup.sql` creates the `vector` extension)
- guard-service running (if it is down, local rules are used instead)
- A Groq API key

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
| `DATABASE_URL` | Neon → branch `dev` → role **resume_svc** → pooled string |
| `DATABASE_URL_MIGRATIONS` | Neon owner role (local only) |
| `GROQ_API_KEY` | console.groq.com → API Keys |
| `EMBEDDING_PROVIDER` | `local` for development (downloads a ~25 MB model on first use), `hf` on Vercel, `none` to use full-text search only |
| `HF_TOKEN` | Only for `hf`: huggingface.co/settings/tokens → fine-grained token with "Make calls to Inference Providers" (free) |
| `INTERNAL_API_KEY` | Same value in all backend services |

Why not `local` on Vercel? transformers.js pulls in onnxruntime (about 430 MB), well over Vercel's 250 MB function limit, so it is a dev-only dependency. With `hf` the same model (all-MiniLM-L6-v2, 384 dimensions) runs on Hugging Face. If embeddings ever fail, resumes are still saved and search falls back to Postgres full-text ranking.

## Database
```bash
npm run db:migrate
```

## Run
```bash
npm run dev               # http://localhost:4002
```

## Try it
```bash
KEY=<INTERNAL_API_KEY>; USER=3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90
curl -X POST http://localhost:4002/api/resumes -H "x-internal-key: $KEY" -H "x-user-id: $USER" \
  -H "content-type: application/json" -d '{"driveUrl":"https://drive.google.com/file/d/<FILE_ID>/view"}'
```

Expected messages:

| Link | Result |
|---|---|
| Public PDF/DOCX resume | `201` with the profile |
| `hello`, other websites, broken file ids | `400 INVALID_URL` "Not a valid URL" |
| Private file | `403 NOT_PUBLIC` "Not a public viewable resume" |
| Folder, Docs, Sheets, Slides, Forms, images | `422 LINK_NOT_VALID` "Link is not valid" |
| Public file that isn't a resume | `422 NOT_A_RESUME` "Please add resume link" |
| Resume with hidden instructions to the AI | sanitized and flagged, or `422 RESUME_UNSAFE` |

## Test and lint
```bash
npm test                  # real PDF parsing, PGlite + pgvector, mocked Drive/Groq
npm run lint
```

## Deploy to Vercel
1. Root Directory `backend/resume-service`, Node 24.
2. Env vars: `.env.example` keys except `PORT`/`DATABASE_URL_MIGRATIONS`; `NODE_ENV=production`; **`EMBEDDING_PROVIDER=hf` + `HF_TOKEN`** (or `none`); `GUARD_SERVICE_URL` = deployed guard URL.
3. `npm run db:migrate` once against Neon **main**.
4. Settings → Functions: set Max Duration to 60 s if your plan's default is lower (ingestion takes 5–15 s).

## Troubleshooting
| Symptom | Fix |
|---|---|
| Every link says "Not a public viewable resume" | The file is shared with specific people. Use Share → General access → "Anyone with the link" |
| `type "vector" does not exist` | Run `CREATE EXTENSION vector;` (in `scripts/db-setup.sql`) and make sure the role's search_path includes `public` |
| `HF_TOKEN is required when EMBEDDING_PROVIDER=hf` | Add the token or switch the provider to `local` / `none` |
| Log shows `embedding_failed` | The provider is unavailable; search still works through full-text fallback |

## Versions (pinned at scaffold, 2026-10-26)
express 5.3.0 · groq-sdk 1.6.0 · unpdf 1.9.1 · mammoth 1.13.0 · drizzle-orm 0.45.4 · @neondatabase/serverless 1.2.0 · zod 4.6.7 · (dev) @huggingface/transformers 4.3.1, @electric-sql/pglite 0.5.11
