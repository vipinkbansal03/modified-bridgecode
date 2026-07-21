import { Router } from "express";
import { protect, requirePermission } from "../../middleware/auth.middleware";
import * as C from "./reviews.controller";

const router = Router();
router.use(protect);

router.get("/", requirePermission("products.view", "products.manage"), C.list);
router.patch("/:id/status", requirePermission("products.update", "products.manage"), C.updateStatus);
router.delete("/:id", requirePermission("products.delete", "products.manage"), C.remove);

export default router;
