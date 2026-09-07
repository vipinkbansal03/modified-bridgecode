import { Router } from "express";
import { protect, requirePermission } from "../../middleware/auth.middleware";
import * as C from "./warehouse.controller";

const router = Router();

router.use(protect);

router.get("/", requirePermission("inventory.view", "inventory.manage"), C.list);
router.post("/", requirePermission("inventory.manage"), C.create);
router.post("/bulk/permanent", requirePermission("inventory.manage"), C.bulkPermanentDelete);
router.put("/:id", requirePermission("inventory.manage"), C.update);
router.delete("/:id", requirePermission("inventory.manage"), C.remove);
router.post("/:id/restore", requirePermission("inventory.manage"), C.restore);
router.put("/:id/restore", requirePermission("inventory.manage"), C.restore);
router.delete("/:id/permanent", requirePermission("inventory.manage"), C.permanentDelete);

export default router;
