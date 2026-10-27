import express from "express";
import helmet from "helmet";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { requestId } from "./middleware/requestId.js";
import { stripInternalHeaders } from "./middleware/stripInternalHeaders.js";
import { buildProxyRouter } from "./routes/proxyRoutes.js";

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", true);
app.use(requestId);
app.use(helmet());

const health = (_req, res) => res.json({ status: "ok", service: "gateway-service", version: "1.0.0" });
app.get("/health", health);
app.get("/api/health", health);

app.use(stripInternalHeaders);
app.use(buildProxyRouter());

app.use(notFound);
app.use(errorHandler);

export default app;
