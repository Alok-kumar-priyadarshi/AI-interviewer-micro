const REDACTED_KEYS =
  /^(authorization|cookie|set-cookie|password|passwordhash|token|accesstoken|refreshtoken|apikey|x-internal-key|groq_api_key)$/i;

function redact(value, depth = 0) {
  if (depth > 4 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    out[key] = REDACTED_KEYS.test(key) ? "[redacted]" : redact(item, depth + 1);
  }
  return out;
}

/** JSON-lines logger. Silent under tests so test output stays readable. */
export function createLogger(service) {
  const write = (level, msg, meta) => {
    if (process.env.NODE_ENV === "test" && !process.env.LOG_IN_TESTS) return;
    const line = JSON.stringify({
      time: new Date().toISOString(),
      level,
      service,
      msg,
      ...redact(meta ?? {}),
    });
    const stream = level === "error" || level === "warn" ? process.stderr : process.stdout;
    stream.write(`${line}\n`);
  };
  return {
    info: (msg, meta) => write("info", msg, meta),
    warn: (msg, meta) => write("warn", msg, meta),
    error: (msg, meta) => write("error", msg, meta),
  };
}

export const logger = createLogger("interview-service");
