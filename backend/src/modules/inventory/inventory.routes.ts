import { Router } from "express";
import { protect } from "../../middleware/auth.middleware";
import * as C from "./inventory.controller";
const router = Router();
router.use(protect);
router.get("/", C.list);
router.get("/alerts", C.alerts);
router.put("/:id", C.update);
export default router;
