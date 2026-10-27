import { Router } from "express";
import * as controller from "../controllers/interviewController.js";

export const interviewRoutes = Router();

interviewRoutes.post("/", controller.create);
interviewRoutes.get("/", controller.list);
interviewRoutes.get("/:id", controller.get);
interviewRoutes.post("/:id/next", controller.next);
interviewRoutes.post("/:id/turns/:turnId/answer", controller.answer);
interviewRoutes.post("/:id/end", controller.end);
