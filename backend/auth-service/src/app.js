// Must run before anything makes an outbound request.
import "./lib/keepAlive.js";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { internalAuth } from "./middleware/internalAuth.js";
import { requestId } from "./middleware/requestId.js";
import { authRoutes } from "./routes/authRoutes.js";

const app = express();

app.disable("x-powered-by");
app.use(requestId);
app.use(helmet());

app.get("/health", (_req, res) => res.json({ status: "ok", service: "auth-service", version: "1.0.0" }));

app.use(internalAuth);
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());
app.use("/api/auth", authRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
