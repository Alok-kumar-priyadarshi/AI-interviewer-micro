import { Router } from "express";
import * as controller from "../controllers/resumeController.js";

export const resumeRoutes = Router();
resumeRoutes.post("/", controller.create);
resumeRoutes.get("/", controller.list);
resumeRoutes.get("/:id", controller.get);
resumeRoutes.delete("/:id", controller.remove);

export const internalResumeRoutes = Router();
internalResumeRoutes.get("/:id/profile", controller.internalProfile);
internalResumeRoutes.post("/:id/search", controller.internalSearch);
