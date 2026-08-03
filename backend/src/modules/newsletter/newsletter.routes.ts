import { Router } from "express";
import { protect, requirePermission } from "../../middleware/auth.middleware";
import * as controller from "./newsletter.controller";

export const publicRouter = Router();
publicRouter.post("/subscribe", controller.publicSubscribe);
publicRouter.post("/unsubscribe", controller.publicUnsubscribe);

export const adminRouter = Router();
adminRouter.use(protect);
adminRouter.get("/subscribers", requirePermission("contactSubmissions.view"), controller.adminListSubscribers);
adminRouter.post("/subscribers", requirePermission("contactSubmissions.manage"), controller.adminCreateSubscriber);
adminRouter.patch("/subscribers/:id/status", requirePermission("contactSubmissions.manage"), controller.adminUpdateStatus);
