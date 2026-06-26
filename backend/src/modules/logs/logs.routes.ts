import { Router } from "express";
import { protect, requirePermission } from "../../middleware/auth.middleware";
import * as LogsController from "./logs.controller";

const router = Router();

router.use(protect, requirePermission("logs.view"));
router.get("/", LogsController.list);

export default router;
