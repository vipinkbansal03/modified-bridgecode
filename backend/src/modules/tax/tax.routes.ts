import { Router } from "express";
import multer from "multer";
import { protect, requirePermission } from "../../middleware/auth.middleware";
import * as TaxController from "./tax.controller";

const upload = multer({ dest: "uploads/" });
const router = Router();

router.use(protect);

router.get("/", requirePermission("pricing.view", "pricing.manage"), TaxController.list);
router.get("/dashboard", requirePermission("pricing.view", "pricing.manage"), TaxController.dashboard);
router.get("/preview", requirePermission("pricing.view", "pricing.manage"), TaxController.preview);
router.get("/export", requirePermission("pricing.view", "pricing.manage"), TaxController.exportSpreadsheet);
router.post("/import/preview", requirePermission("pricing.manage"), upload.single("file"), TaxController.previewImport);
router.post("/import", requirePermission("pricing.manage"), upload.single("file"), TaxController.importSpreadsheet);
router.post("/bulk", requirePermission("pricing.manage"), TaxController.bulk);
router.post("/", requirePermission("pricing.manage"), TaxController.create);
router.put("/:id", requirePermission("pricing.manage"), TaxController.update);
router.delete("/:id", requirePermission("pricing.manage"), TaxController.remove);

export default router;
