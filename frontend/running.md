# frontend: running guide

React 19 single-page app (Vite 8, Tailwind CSS 4, React Router 8, TanStack Query, Zustand). The browser only ever calls its own origin: `/api` is proxied to the gateway by Vite locally, and by the `vercel.json` rewrite in production. Design: [docs/04-services.md](../docs/04-services.md#frontend-port-5173).

## Prerequisites
- Node.js 24
- The backend running (at least gateway, auth and the services you use). `scripts/dev-all.ps1` starts everything

## Install / configure
```bash
npm install
cp .env.example .env
```

| Key | Purpose |
|---|---|
| `VITE_API_BASE_URL` | Keep `/api` |
| `VITE_DEV_GATEWAY_URL` | Where the dev proxy sends `/api` (default `http://localhost:4000`) |

## Run
```bash
npm run dev               # http://localhost:5173
```
Voice answers need microphone permission. Browsers allow the microphone on `localhost` and on HTTPS sites.

## Test, lint, build
```bash
npm test
npm run lint
npm run build             # outputs dist/
npm run preview           # serves the production build locally
```

## Deploy to Vercel
1. Deploy the gateway first and copy its URL.
2. In `vercel.json`, replace `https://mi-gateway.vercel.app` in the `/api/:path*` rewrite with your gateway URL. Commit.
3. New Project → Root Directory `frontend`, framework **Vite**, Node 24. No env vars are needed (`/api` is the default).
4. Deploy, open the site, sign up, and run an interview.

The same `vercel.json` sets the security headers (CSP, Permissions-Policy with microphone allowed for this site only, HSTS, nosniff) and the SPA fallback.

## Troubleshooting
| Symptom | Fix |
|---|---|
| Every page bounces to /login after a reload | The refresh cookie isn't reaching auth-service. Make sure the app is opened through the frontend URL (same origin), not the gateway URL |
| "Can't reach the server" | Gateway not running, or wrong `VITE_DEV_GATEWAY_URL` / rewrite destination |
| Speak tab disabled | Browser lacks MediaRecorder support. Use a current Chrome, Edge, Firefox or Safari |
| Questions aren't read aloud | Turn "Auto-read" on, and check the browser's speech voices / system volume |

## Note on npm peer dependencies
`vite` (needed by Vitest) and `@testing-library/dom` are listed explicitly, so installs work even if your npm has `legacy-peer-deps=true`.

## Versions (pinned at scaffold, 2026-10-26)
react 19.3.1 · react-router 8.5.0 · vite 8.3.5 · tailwindcss 4.3.3 · @tanstack/react-query 5.104.5 · zustand 5.0.16 · lucide-react 1.61.0 · vitest 5.0.5
