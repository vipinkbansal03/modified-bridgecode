import { Router } from "express"; import { protect } from "../../middleware/auth.middleware"; import * as C from "./ai.controller";
const router = Router(); router.use(protect); router.post("/generate", C.generate); router.post("/translate", C.translate); export default router;
