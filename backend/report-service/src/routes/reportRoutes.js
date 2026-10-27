import { Router } from "express";
import * as controller from "../controllers/reportController.js";

export const reportRoutes = Router();
reportRoutes.get("/", controller.list);
reportRoutes.get("/by-session/:sessionId", controller.getBySession);

export const internalReportRoutes = Router();
internalReportRoutes.post("/", controller.create);
