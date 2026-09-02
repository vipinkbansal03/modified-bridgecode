import { Router } from "express";
import { protect, requirePermission } from "../../middleware/auth.middleware";
import * as C from "./reviews.controller";

const router = Router();
router.use(protect);

router.get("/", requirePermission("reviews.view", "products.view", "products.manage"), C.list);
router.patch("/:id/status", requirePermission("reviews.update", "products.update", "products.manage"), C.updateStatus);
router.delete("/:id", requirePermission("reviews.delete", "products.delete", "products.manage"), C.remove);

export default router;
