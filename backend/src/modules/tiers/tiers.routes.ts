import { Router } from "express";
import { protect, requirePermission } from "../../middleware/auth.middleware";
import * as C from "./tiers.controller";

const router = Router();
router.use(protect);

router.get("/", requirePermission("pricing.view", "pricing.manage"), C.list);
router.post("/", requirePermission("pricing.manage"), C.create);
router.put("/reorder", requirePermission("pricing.manage"), C.reorder);
router.get("/:id/countries", requirePermission("pricing.view", "pricing.manage"), C.listCountries);
router.put("/:id/countries", requirePermission("pricing.manage"), C.updateCountries);
router.put("/:id", requirePermission("pricing.manage"), C.update);
router.delete("/:id", requirePermission("pricing.manage"), C.remove);

export default router;
