// Local development entry. On Vercel, src/app.js is used directly (default export).
import app from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";

app.listen(env.PORT, () => {
  logger.info("listening", { url: `http://localhost:${env.PORT}` });
});
