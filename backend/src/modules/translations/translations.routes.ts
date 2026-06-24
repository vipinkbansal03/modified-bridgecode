import { Router } from "express";
import { protect } from "../../middleware/auth.middleware";
import * as C from "./translations.controller";

const router = Router();
router.use(protect);

router.get("/coverage", C.getTranslationCoverage);
router.get("/languages", C.listLanguages);
router.post("/languages", C.createLanguage);
router.get("/review-queue", C.listReviewQueue);
router.post("/review-queue/approve", C.bulkApproveTranslations);
router.get("/products/:productId", C.getProductTranslations);
router.put("/products/:productId/:languageId", C.upsertProductTranslation);
router.put("/products/translations/:id/approve", C.approveTranslation);
router.put("/products/translations/:id/reject", C.rejectTranslation);
router.put("/categories/:categoryId/:languageId", C.upsertCategoryTranslation);
router.put("/:id", C.updateTranslation);
router.post("/generate", C.generateTranslations);
router.get("/keywords", C.listKeywords);
router.post("/keywords", C.createKeyword);
router.put("/keywords", C.upsertKeyword);
router.delete("/keywords/:id", C.deleteKeyword);
router.get("/protected-keywords", C.listProtectedKeywords);
router.post("/protected-keywords", C.createProtectedKeyword);
router.delete("/protected-keywords/:id", C.deleteProtectedKeyword);

export default router;
