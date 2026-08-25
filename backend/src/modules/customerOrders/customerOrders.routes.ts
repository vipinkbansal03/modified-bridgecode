import { Router } from "express";
import { protectCustomer } from "../../middleware/customerAuth.middleware";
import * as C from "./customerOrders.controller";

const router = Router();
router.use(protectCustomer);

router.get("/", C.list);
router.get("/:id/invoice", C.invoice);
router.post("/estimate", C.estimate);
router.post("/", C.create);
router.get("/:id/payment-session", C.getPaymentSession);
router.get("/:id/tracking", C.getTracking);
router.post("/:id/payment/failure", C.recordFailure);
router.post("/:id/razorpay-order", C.createRazorpayOrder);
router.post("/:id/verify-razorpay", C.verifyRazorpayPayment);
router.post("/:id/cancel", C.cancelOrder);

export default router;
