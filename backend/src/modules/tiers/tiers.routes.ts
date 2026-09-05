import { Router } from "express";
import { upload } from "../../middleware/upload.middleware";
import { protect, requirePermission } from "../../middleware/auth.middleware";
import * as C from "./tiers.controller";

const router = Router();
router.use(protect);

router.get("/", requirePermission("tiers.view", "tiers.manage"), C.list);
router.get("/simple", requirePermission("tiers.view", "tiers.manage"), C.simpleList);
router.get("/dashboard", requirePermission("tiers.view", "tiers.manage"), C.dashboard);
router.get("/export", requirePermission("tiers.view", "tiers.manage"), C.exportSpreadsheet);
router.get("/sample-template", requirePermission("tiers.view", "tiers.manage"), C.downloadSampleTemplate);
router.post("/import/preview", requirePermission("tiers.create", "tiers.update", "tiers.manage"), upload.single("file"), C.previewImport);
router.post("/import", requirePermission("tiers.create", "tiers.update", "tiers.manage"), upload.single("file"), C.importSpreadsheet);
router.post("/bulk", requirePermission("tiers.update", "tiers.delete", "tiers.manage"), C.bulk);
router.post("/", requirePermission("tiers.create", "tiers.manage"), C.create);
router.put("/reorder", requirePermission("tiers.update", "tiers.manage"), C.reorder);
router.get("/:id/countries", requirePermission("tiers.view", "tiers.manage"), C.listCountries);
router.put("/:id/countries", requirePermission("tiers.update", "tiers.manage"), C.updateCountries);
router.put("/:id", requirePermission("tiers.update", "tiers.manage"), C.update);
router.delete("/:id", requirePermission("tiers.delete", "tiers.manage"), C.remove);

export default router;
