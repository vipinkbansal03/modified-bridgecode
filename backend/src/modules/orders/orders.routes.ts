import { Router } from "express"; import { protect } from "../../middleware/auth.middleware"; import * as C from "./orders.controller";
const router = Router(); router.use(protect);
router.get("/", C.list); router.get("/:id", C.getOne); router.put("/:id/status", C.updateStatus); router.put("/:id/payment-status", C.updatePayment); router.put("/:id/shipping", C.updateShipping);
export default router;
