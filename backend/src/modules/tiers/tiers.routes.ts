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
router.post("/import/preview", requirePermission("tiers.create", "tiers.update", "tiers.manage"), upload.single("file"), C.previewImport);
router.post("/import", requirePermission("tiers.create", "tiers.update", "tiers.manage"), upload.single("file"), C.importSpreadsheet);
router.post("/bulk/restore", requirePermission("tiers.update", "tiers.manage"), C.bulkRestore);
router.post("/bulk/permanent", requirePermission("tiers.delete", "tiers.manage"), C.bulkPermanentDelete);
router.post("/bulk", requirePermission("tiers.update", "tiers.delete", "tiers.manage"), C.bulk);
router.post("/", requirePermission("tiers.create", "tiers.manage"), C.create);
router.put("/reorder", requirePermission("tiers.update", "tiers.manage"), C.reorder);
router.get("/:id/countries", requirePermission("tiers.view", "tiers.manage"), C.listCountries);
router.put("/:id/countries", requirePermission("tiers.update", "tiers.manage"), C.updateCountries);
router.post("/:id/restore", requirePermission("tiers.update", "tiers.manage"), C.restore);
router.put("/:id/restore", requirePermission("tiers.update", "tiers.manage"), C.restore);
router.delete("/:id/permanent", requirePermission("tiers.delete", "tiers.manage"), C.permanentDelete);
router.put("/:id", requirePermission("tiers.update", "tiers.manage"), C.update);
router.delete("/:id", requirePermission("tiers.delete", "tiers.manage"), C.remove);

export default router;
