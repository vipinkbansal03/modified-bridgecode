import { Router } from "express";
import { protect, requirePermission } from "../../middleware/auth.middleware";
import * as C from "./customers.controller";

const router = Router();
router.use(protect);

router.get("/", requirePermission("customers.view", "customers.manage"), C.list);
router.post("/", requirePermission("customers.manage"), C.create);
router.get("/:id/orders", requirePermission("customers.view", "customers.manage"), C.listOrders);
router.get("/:id/addresses", requirePermission("customers.view", "customers.manage"), C.listAddresses);
router.put("/:id/addresses/:addressId", requirePermission("customers.manage"), C.updateAddress);
router.get("/:id", requirePermission("customers.view", "customers.manage"), C.getOne);
router.put("/:id", requirePermission("customers.manage"), C.update);
router.patch("/:id", requirePermission("customers.manage"), C.update);
router.put("/:id/tier", requirePermission("customers.manage"), C.updateTier);
router.put("/:id/role", requirePermission("customers.manage"), C.updateRole);
router.post("/:id/approve", requirePermission("customers.manage"), C.approve);
router.post("/:id/reject", requirePermission("customers.manage"), C.reject);
router.post("/:id/restore", requirePermission("customers.manage"), C.restore);
router.delete("/:id", requirePermission("customers.manage"), C.remove);

export default router;
