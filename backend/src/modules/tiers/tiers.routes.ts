import { Router } from "express";
import { upload } from "../../middleware/upload.middleware";
import { protect, requirePermission } from "../../middleware/auth.middleware";
import * as C from "./tiers.controller";

const router = Router();
router.use(protect);

router.get("/", requirePermission("pricing.view", "pricing.manage"), C.list);
router.get("/simple", requirePermission("pricing.view", "pricing.manage"), C.simpleList);
router.get("/dashboard", requirePermission("pricing.view", "pricing.manage"), C.dashboard);
router.get("/export", requirePermission("pricing.view", "pricing.manage"), C.exportSpreadsheet);
router.post("/import/preview", requirePermission("pricing.manage"), upload.single("file"), C.previewImport);
router.post("/import", requirePermission("pricing.manage"), upload.single("file"), C.importSpreadsheet);
router.post("/bulk", requirePermission("pricing.manage"), C.bulk);
router.post("/", requirePermission("pricing.manage"), C.create);
router.put("/reorder", requirePermission("pricing.manage"), C.reorder);
router.get("/:id/countries", requirePermission("pricing.view", "pricing.manage"), C.listCountries);
router.put("/:id/countries", requirePermission("pricing.manage"), C.updateCountries);
router.put("/:id", requirePermission("pricing.manage"), C.update);
router.delete("/:id", requirePermission("pricing.manage"), C.remove);

export default router;
