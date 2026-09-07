import { Router } from "express";
import { protect, requirePermission } from "../../middleware/auth.middleware";
import * as C from "./reviews.controller";

const router = Router();
router.use(protect);

router.get("/", requirePermission("reviews.view", "products.view", "products.manage"), C.list);
router.post("/bulk/permanent", requirePermission("reviews.delete", "products.delete", "products.manage"), C.bulkPermanentDelete);
router.post("/bulk/restore", requirePermission("reviews.update", "products.update", "products.manage"), C.bulkRestore);
router.patch("/:id/status", requirePermission("reviews.update", "products.update", "products.manage"), C.updateStatus);
router.post("/:id/restore", requirePermission("reviews.update", "products.update", "products.manage"), C.restore);
router.put("/:id/restore", requirePermission("reviews.update", "products.update", "products.manage"), C.restore);
router.delete("/:id/permanent", requirePermission("reviews.delete", "products.delete", "products.manage"), C.permanentDelete);
router.delete("/:id", requirePermission("reviews.delete", "products.delete", "products.manage"), C.remove);

export default router;
