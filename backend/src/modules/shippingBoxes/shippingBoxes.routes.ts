import { Router } from "express";
import { protect, requirePermission } from "../../middleware/auth.middleware";
import * as C from "./shippingBoxes.controller";

const router = Router();
router.use(protect);

router.get("/", requirePermission("shipping.view", "shipping.manage"), C.list);
router.get("/:id", requirePermission("shipping.view", "shipping.manage"), C.getOne);
router.post("/", requirePermission("shipping.manage"), C.create);
router.put("/:id", requirePermission("shipping.manage"), C.update);
router.post("/:id/toggle", requirePermission("shipping.manage"), C.toggle);
router.delete("/:id", requirePermission("shipping.manage"), C.remove);

export default router;
