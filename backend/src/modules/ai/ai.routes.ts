import { Router } from "express"; import { protect, requirePermission } from "../../middleware/auth.middleware"; import * as C from "./ai.controller";
const router = Router(); router.use(protect); router.post("/generate", requirePermission("ai.manage"), C.generate); router.post("/translate", requirePermission("ai.manage"), C.translate); export default router;
