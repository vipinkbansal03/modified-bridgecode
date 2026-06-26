import { Router } from "express";
import { protect, requirePermission } from "../../middleware/auth.middleware";
import * as TaxController from "./tax.controller";

const router = Router();
router.use(protect);

router.get("/", requirePermission("pricing.view", "pricing.manage"), TaxController.list);
router.post("/", requirePermission("pricing.manage"), TaxController.create);
router.put("/:id", requirePermission("pricing.manage"), TaxController.update);
router.delete("/:id", requirePermission("pricing.manage"), TaxController.remove);

export default router;
