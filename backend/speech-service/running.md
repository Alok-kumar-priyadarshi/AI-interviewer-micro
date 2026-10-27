# speech-service: running guide

Turns a recorded answer into text with Groq Whisper (`whisper-large-v3-turbo`, falling back to `whisper-large-v3`). It has no database, and audio is never stored. Design: [docs/04-services.md](../../docs/04-services.md#speech-service-port-4004).

## Install / configure
```bash
npm install
cp .env.example .env
```

| Key | Where to get it |
|---|---|
| `GROQ_API_KEY` | console.groq.com |
| `INTERNAL_API_KEY` | Same value in all backend services |
| `MAX_AUDIO_MB` | Default 4 (Vercel's request limit is 4.5 MB; 3 minutes of opus is about 1.5 MB) |

## Run
```bash
npm run dev               # http://localhost:4004
```

## Try it
```bash
curl -X POST http://localhost:4004/api/speech/transcribe \
  -H "x-internal-key: <KEY>" -H "x-user-id: 3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90" \
  -F "audio=@answer.webm;type=audio/webm" -F "hint=React, PostgreSQL, Docker"
# -> {"text":"...","durationSec":12.3}
```
Accepted: webm, ogg, mp4/m4a, mp3, wav. The file's bytes must match its declared type.

## Test and lint
```bash
npm test
npm run lint
```

## Deploy to Vercel
Root Directory `backend/speech-service`, Node 24. Env vars from `.env.example` (no `PORT`), `NODE_ENV=production`.

## Troubleshooting
| Symptom | Fix |
|---|---|
| `415 UNSUPPORTED_AUDIO` | The recording format isn't in the list, or the file isn't really audio |
| `422 EMPTY_TRANSCRIPT` | Nothing audible was recorded; check the microphone |
| `413 AUDIO_TOO_LARGE` | Recording over the limit; the frontend caps recordings at 3 minutes |

## Versions (pinned at scaffold, 2026-10-26)
express 5.3.0 · multer 2.5.0 · groq-sdk 1.6.0 · zod 4.6.7
