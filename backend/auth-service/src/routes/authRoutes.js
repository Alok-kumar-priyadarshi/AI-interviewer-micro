import { Router } from "express";
import * as controller from "../controllers/authController.js";
import { requireUser } from "../middleware/internalAuth.js";

export const authRoutes = Router();

authRoutes.post("/signup", controller.signup);
authRoutes.post("/login", controller.login);
authRoutes.post("/refresh", controller.refresh);
authRoutes.post("/logout", controller.logout);
authRoutes.get("/me", requireUser, controller.me);
