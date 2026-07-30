import { Router } from "express";
import rateLimit from "express-rate-limit";
import multer from "multer";
import { protect, requirePermission } from "../../middleware/auth.middleware";
import * as TaxController from "./tax.controller";

const upload = multer({ dest: "uploads/" });
const router = Router();
const vatValidationLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many VAT validation requests. Please try again later." },
});

router.post("/identifiers/validate", vatValidationLimiter, TaxController.validateIdentifier);

router.use(protect);

router.post("/addresses/validate", TaxController.validateAddress);

router.get("/", requirePermission("tax.view", "tax.manage"), TaxController.list);
router.get("/dashboard", requirePermission("tax.view", "tax.manage"), TaxController.dashboard);
router.get("/preview", requirePermission("tax.view", "tax.manage"), TaxController.preview);
router.get("/export", requirePermission("tax.view", "tax.manage"), TaxController.exportSpreadsheet);
router.post("/import/preview", requirePermission("tax.manage"), upload.single("file"), TaxController.previewImport);
router.post("/import", requirePermission("tax.manage"), upload.single("file"), TaxController.importSpreadsheet);
router.post("/bulk", requirePermission("tax.manage"), TaxController.bulk);
router.post("/", requirePermission("tax.create", "tax.manage"), TaxController.create);
router.put("/:id", requirePermission("tax.update", "tax.manage"), TaxController.update);
router.delete("/:id", requirePermission("tax.delete", "tax.manage"), TaxController.remove);

export default router;
