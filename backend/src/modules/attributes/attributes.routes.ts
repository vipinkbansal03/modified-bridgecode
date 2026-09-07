import { Router } from "express";
import { protect, requirePermission } from "../../middleware/auth.middleware";
import { upload } from "../../middleware/upload.middleware";
import * as C from "./attributes.controller";

const router = Router();
router.use(protect);

router.get("/", requirePermission("attributes.view", "attributes.manage"), C.list);
router.post("/", requirePermission("attributes.manage"), C.create);
router.put("/reorder", requirePermission("attributes.manage"), C.reorder);
router.post("/bulk/permanent", requirePermission("attributes.manage"), C.bulkPermanentDelete);

// Spreadsheet Export & Import (must precede /:id)
router.get("/export", requirePermission("attributes.view", "attributes.manage"), C.exportSpreadsheet);
router.get("/sample-template", requirePermission("attributes.view", "attributes.manage"), C.downloadSampleTemplate);
router.post("/import/preview", requirePermission("attributes.manage", "attributes.create"), upload.single("file"), C.previewImport);
router.post("/import", requirePermission("attributes.manage", "attributes.create"), upload.single("file"), C.importSpreadsheet);

router.get("/:id", requirePermission("attributes.view", "attributes.manage"), C.getOne);
router.put("/:id", requirePermission("attributes.manage"), C.update);
router.delete("/:id", requirePermission("attributes.manage"), C.remove);
router.post("/:id/restore", requirePermission("attributes.manage"), C.restore);
router.delete("/:id/permanent", requirePermission("attributes.manage"), C.permanentDelete);

router.get("/:id/values", requirePermission("attributes.view", "attributes.manage"), C.listValues);
router.put("/:id/values/reorder", requirePermission("attributes.manage"), C.reorderValues);
router.post("/:id/values", requirePermission("attributes.manage"), C.addValue);
router.put("/:id/values/:valueId", requirePermission("attributes.manage"), C.updateValue);
router.delete("/:id/values/:valueId", requirePermission("attributes.manage"), C.removeValue);
router.delete("/:id/values/:valueId/permanent", requirePermission("attributes.manage"), C.permanentDeleteValue);

export default router;
