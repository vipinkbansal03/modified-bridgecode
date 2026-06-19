import { Router } from "express"; import { protect } from "../../middleware/auth.middleware"; import * as C from "./translations.controller";
const router = Router(); router.use(protect);
router.get("/languages", C.listLanguages); router.post("/languages", C.createLanguage);
router.get("/products/:productId", C.getProductTranslations); router.put("/:id", C.updateTranslation); router.post("/generate", C.generateTranslations);
router.get("/keywords", C.listKeywords); router.post("/keywords", C.createKeyword); router.delete("/keywords/:id", C.deleteKeyword);
export default router;
