import { Agent, setGlobalDispatcher } from "undici";

// Outbound HTTPS calls (Neon's HTTP driver, Groq, Google Drive, Hugging Face) go through fetch.
// Node's default closes idle connections after 4 s, so most requests paid a fresh TLS handshake,
// about 2 s to a distant region, instead of one round trip. Keep connections open longer, but
// below Neon's own idle limit so a reused connection is never one the server already closed.
// Servers that announce a shorter keep-alive (Keep-Alive header) still win.
const KEEP_ALIVE_MS = 60_000;

setGlobalDispatcher(new Agent({ keepAliveTimeout: KEEP_ALIVE_MS, keepAliveMaxTimeout: KEEP_ALIVE_MS }));
