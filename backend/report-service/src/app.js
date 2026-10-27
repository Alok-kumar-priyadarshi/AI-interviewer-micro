// Must run before anything makes an outbound request.
import "./lib/keepAlive.js";
import express from "express";
import helmet from "helmet";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { internalAuth, requireUser } from "./middleware/internalAuth.js";
import { requestId } from "./middleware/requestId.js";
import { internalReportRoutes, reportRoutes } from "./routes/reportRoutes.js";

const app = express();

app.disable("x-powered-by");
app.use(requestId);
app.use(helmet());

app.get("/health", (_req, res) => res.json({ status: "ok", service: "report-service", version: "1.0.0" }));

app.use(internalAuth);
app.use(express.json({ limit: "1mb" }));
app.use("/api/reports", requireUser, reportRoutes);
app.use("/internal/reports", requireUser, internalReportRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
