import { Router } from "express";
import { protect, requirePermission } from "../../middleware/auth.middleware";
import * as C from "./warehouse.controller";

const router = Router();

router.use(protect);

router.get("/", requirePermission("inventory.view", "inventory.manage"), C.list);
router.post("/", requirePermission("inventory.manage"), C.create);
router.put("/:id", requirePermission("inventory.manage"), C.update);
router.delete("/:id", requirePermission("inventory.manage"), C.remove);

export default router;
