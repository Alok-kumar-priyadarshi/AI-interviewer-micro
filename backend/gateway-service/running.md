# gateway-service: running guide

The single public entry point. It verifies the access token (JWT) and forwards each `/api/*` request to the right internal service, adding `x-user-id` and the internal key. It has no database. Design: [docs/04-services.md](../../docs/04-services.md#gateway-service-port-4000).

## Prerequisites
- Node.js 24 (`node -v`)
- The other services running (or at least the one you are calling)

## Install
```bash
npm install
```

## Configure
```bash
cp .env.example .env      # PowerShell: Copy-Item .env.example .env
```

| Key | Where to get it |
|---|---|
| `*_SERVICE_URL` | Local defaults are already correct. On Vercel: each service's production URL |
| `JWT_ACCESS_SECRET` | Must be **identical** to auth-service's `JWT_ACCESS_SECRET` |
| `INTERNAL_API_KEY` | Must be **identical** in all 7 backend services |

Generate a secret: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`

## Run
```bash
npm run dev               # http://localhost:4000, restarts on file changes
curl http://localhost:4000/api/health
```

## Try it
```bash
# Protected route without a token -> 401 TOKEN_INVALID
curl http://localhost:4000/api/resumes

# Signup is public (forwarded to auth-service)
curl -X POST http://localhost:4000/api/auth/signup -H "content-type: application/json" \
  -d '{"name":"Asha","email":"asha@example.com","password":"secret123"}'
```

## Test and lint
```bash
npm test
npm run lint
```

## Deploy to Vercel
1. New Project → import the repo → **Root Directory** `backend/gateway-service` (framework: Other/Express, Node 24).
2. Environment variables: everything in `.env.example` except `PORT`, with `NODE_ENV=production` and the `https://` URLs of the deployed services.
3. Settings → Git → Ignored Build Step: `git diff --quiet HEAD^ HEAD -- .`
4. Deploy, then open `https://<project>.vercel.app/api/health`.
5. Put this URL into `frontend/vercel.json` (the `/api` rewrite destination).

## Troubleshooting
| Symptom | Fix |
|---|---|
| `Invalid environment variables: …` on start | A key in `.env` is missing or malformed (URLs need `http(s)://`, secrets need 32+ characters) |
| Every call returns `502 UPSTREAM_UNAVAILABLE` | The target service is not running, or its URL is wrong |
| Valid logins still get `TOKEN_INVALID` | `JWT_ACCESS_SECRET` differs between gateway and auth-service |
| Services answer `401 UNAUTHORIZED_INTERNAL` | `INTERNAL_API_KEY` differs between services |

## Versions (pinned at scaffold, 2026-10-26)
express 5.3.0 · helmet 8.3.0 · jose 6.2.13 · zod 4.6.7 · vitest 5.0.5 · supertest 7.3.1 · eslint 10.13.0
