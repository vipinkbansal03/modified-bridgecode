import { Router } from "express"; import { protect, requirePermission } from "../../middleware/auth.middleware"; import * as C from "./payments.controller";
const router = Router(); router.use(protect, requirePermission("payments.manage"));
router.get("/", C.listGateways); router.post("/", C.upsertGateway);
export default router;
