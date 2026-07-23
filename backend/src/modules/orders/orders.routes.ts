import { Router } from "express";
import { protect, requirePermission } from "../../middleware/auth.middleware";
import * as C from "./orders.controller";

const router = Router();
router.use(protect);

router.get("/", requirePermission("orders.view", "orders.manage"), C.list);
router.post("/", requirePermission("orders.manage"), C.create);
router.get("/analytics", requirePermission("orders.view", "orders.manage"), C.analytics);
router.get("/:id/invoice", requirePermission("orders.manage"), C.invoice);
router.get("/:id", requirePermission("orders.view", "orders.manage"), C.getOne);
router.put("/:id/status", requirePermission("orders.manage"), C.updateStatus);
router.put("/:id/payment-status", requirePermission("orders.manage"), C.updatePayment);
router.put("/:id/shipping", requirePermission("orders.manage"), C.updateShipping);
router.post("/:id/ship", requirePermission("orders.manage"), C.ship);
router.post("/:id/deliver", requirePermission("orders.manage"), C.deliver);
router.delete("/:id", requirePermission("orders.delete", "orders.manage"), C.deleteOne);

export default router;
