import { Router } from "express";
import { protect, requirePermission } from "../../middleware/auth.middleware";
import * as C from "./shipping.controller";

const router = Router();
router.use(protect);

router.get("/providers", requirePermission("shipping.view", "shipping.manage"), C.listProviders);
router.post("/providers", requirePermission("shipping.manage"), C.upsertProvider);
router.get("/zones", requirePermission("shipping.view", "shipping.manage"), C.listZones);
router.post("/zones", requirePermission("shipping.manage"), C.createZone);
router.put("/zones/:id", requirePermission("shipping.manage"), C.updateZone);
router.delete("/zones/:id", requirePermission("shipping.manage"), C.deleteZone);
router.post("/calculate", requirePermission("shipping.view", "shipping.manage"), C.calculate);

export default router;
