import { Router } from "express";
import multer from "multer";
import { protect, requirePermission } from "../../middleware/auth.middleware";
import * as DiscountsController from "./discounts.controller";

const router = Router();
const upload = multer({ dest: "uploads/" });

router.use(protect);
router.get("/", requirePermission("discounts.view", "discounts.manage"), DiscountsController.list);
router.get("/dashboard", requirePermission("discounts.view", "discounts.manage"), DiscountsController.dashboard);
router.get("/export", requirePermission("discounts.view", "discounts.manage"), DiscountsController.exportSpreadsheet);
router.post("/import/preview", requirePermission("discounts.manage"), upload.single("file"), DiscountsController.previewImport);
router.post("/import", requirePermission("discounts.manage"), upload.single("file"), DiscountsController.importSpreadsheet);
router.post("/bulk/restore", requirePermission("discounts.manage"), DiscountsController.bulkRestore);
router.post("/bulk/permanent", requirePermission("discounts.manage"), DiscountsController.bulkPermanentDelete);
router.post("/bulk", requirePermission("discounts.manage"), DiscountsController.bulk);
router.post("/", requirePermission("discounts.manage"), DiscountsController.create);
router.post("/:id/restore", requirePermission("discounts.manage"), DiscountsController.restore);
router.put("/:id/restore", requirePermission("discounts.manage"), DiscountsController.restore);
router.delete("/:id/permanent", requirePermission("discounts.manage"), DiscountsController.permanentDelete);
router.put("/:id", requirePermission("discounts.manage"), DiscountsController.update);
router.delete("/:id", requirePermission("discounts.manage"), DiscountsController.remove);

export default router;
