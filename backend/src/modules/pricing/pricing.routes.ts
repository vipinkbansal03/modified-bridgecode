import { Router } from "express";
import { protect, requirePermission } from "../../middleware/auth.middleware";
import { upload } from "../../middleware/upload.middleware";
import * as C from "./pricing.controller";

const router = Router();

router.use(protect);

router.get("/dashboard", requirePermission("pricing.view", "pricing.manage"), C.dashboard);
router.get("/preview", requirePermission("pricing.view", "pricing.manage"), C.preview);
router.get("/export", requirePermission("pricing.view", "pricing.manage"), C.exportSpreadsheet);
router.post("/import/preview", requirePermission("pricing.manage"), upload.single("file"), C.previewImport);
router.post("/import", requirePermission("pricing.manage"), upload.single("file"), C.importSpreadsheet);
router.post("/generate-country-prices", requirePermission("pricing.manage"), C.generateForCountries);
router.post("/bulk", requirePermission("pricing.manage"), C.bulk);
router.post("/:id/duplicate", requirePermission("pricing.manage"), C.duplicate);
router.delete("/:id", requirePermission("pricing.manage"), C.remove);
router.get("/", requirePermission("pricing.view", "pricing.manage"), C.list);
router.post("/", requirePermission("pricing.manage"), C.create);
router.put("/:id", requirePermission("pricing.manage"), C.update);

// Re-export existing product pricing rule CRUD through the pricing admin surface.
router.post("/:id/tier-pricing", requirePermission("pricing.manage"), C.createTierPricing);
router.put("/:id/tier-pricing/:ruleId", requirePermission("pricing.manage"), C.updateTierPricing);
router.delete("/:id/tier-pricing/:ruleId", requirePermission("pricing.manage"), C.deleteTierPricing);
router.post("/:id/moq-pricing", requirePermission("pricing.manage"), C.createMoqPricing);
router.put("/:id/moq-pricing/:ruleId", requirePermission("pricing.manage"), C.updateMoqPricing);
router.delete("/:id/moq-pricing/:ruleId", requirePermission("pricing.manage"), C.deleteMoqPricing);

export default router;
