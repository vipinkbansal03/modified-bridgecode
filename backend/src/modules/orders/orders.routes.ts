import { Router } from "express";
import { protect } from "../../middleware/auth.middleware";
import * as C from "./orders.controller";

const router = Router();
router.use(protect);

router.get("/", C.list);
router.get("/analytics", C.analytics);
router.get("/:id", C.getOne);
router.put("/:id/status", C.updateStatus);
router.put("/:id/payment-status", C.updatePayment);
router.put("/:id/shipping", C.updateShipping);
router.post("/:id/ship", C.ship);
router.post("/:id/deliver", C.deliver);

export default router;
