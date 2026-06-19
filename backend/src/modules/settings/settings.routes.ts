import { Router } from "express"; import { protect, requirePermission } from "../../middleware/auth.middleware"; import * as C from "./settings.controller";
const router = Router(); router.use(protect, requirePermission("settings.manage")); router.get("/", C.get); router.put("/", C.update); export default router;
