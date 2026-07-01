import { Router } from "express";
import { protect, requirePermission } from "../../middleware/auth.middleware";
import { upload } from "../../middleware/upload.middleware";
import * as C from "./translations.controller";

const router = Router();
router.use(protect);

router.get("/coverage", requirePermission("translations.view", "translations.manage"), C.getTranslationCoverage);
router.get("/coverage/export", requirePermission("translations.view", "translations.manage"), C.exportCoverageCsv);
router.post("/coverage/import", requirePermission("translations.manage"), upload.single("file"), C.importTranslationsCsv);
router.get("/languages", requirePermission("translations.view", "translations.manage"), C.listLanguages);
router.post("/languages", requirePermission("translations.manage"), C.createLanguage);
router.put("/languages/:id", requirePermission("translations.manage"), C.updateLanguage);
router.get("/review-queue", requirePermission("translations.view", "translations.manage"), C.listReviewQueue);
router.post("/review-queue/approve", requirePermission("translations.manage"), C.bulkApproveTranslations);
router.get("/products/:productId", requirePermission("translations.view", "translations.manage"), C.getProductTranslations);
router.put("/products/:productId/:languageId", requirePermission("translations.manage"), C.upsertProductTranslation);
router.put("/products/translations/:id/approve", requirePermission("translations.manage"), C.approveTranslation);
router.put("/products/translations/:id/reject", requirePermission("translations.manage"), C.rejectTranslation);
router.put("/categories/:categoryId/:languageId", requirePermission("translations.manage"), C.upsertCategoryTranslation);
router.post("/generate", requirePermission("translations.manage"), C.generateTranslations);
router.get("/keywords", requirePermission("translations.view", "translations.manage"), C.listKeywords);
router.post("/keywords", requirePermission("translations.manage"), C.createKeyword);
router.put("/keywords", requirePermission("translations.manage"), C.upsertKeyword);
router.delete("/keywords/:id", requirePermission("translations.manage"), C.deleteKeyword);
router.get("/protected-keywords", requirePermission("translations.view", "translations.manage"), C.listProtectedKeywords);
router.post("/protected-keywords", requirePermission("translations.manage"), C.createProtectedKeyword);
router.delete("/protected-keywords/:id", requirePermission("translations.manage"), C.deleteProtectedKeyword);
router.put("/:id", requirePermission("translations.manage"), C.updateTranslation);

export default router;
