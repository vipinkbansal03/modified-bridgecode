import { Router } from "express";
import { protect, requirePermission } from "../../middleware/auth.middleware";
import * as couponController from "./coupons.controller";

const router = Router();

router.use(protect);

router.get("/", requirePermission("coupons.view", "coupons.manage"), couponController.list);
router.post("/", requirePermission("coupons.manage"), couponController.create);
router.put("/:id", requirePermission("coupons.manage"), couponController.update);
router.delete("/:id", requirePermission("coupons.manage"), couponController.remove);
router.post("/validate", requirePermission("coupons.view", "coupons.manage"), couponController.validate);

export default router;
