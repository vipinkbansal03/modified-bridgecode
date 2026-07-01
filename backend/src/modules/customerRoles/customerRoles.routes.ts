import { Router } from "express";
import { protect, requirePermission } from "../../middleware/auth.middleware";
import * as CustomerRolesController from "./customerRoles.controller";

const router = Router();

router.use(protect);

router.get("/", requirePermission("customers.manage", "customers.view"), CustomerRolesController.list);
router.post("/", requirePermission("customers.manage"), CustomerRolesController.create);
router.put("/:id", requirePermission("customers.manage"), CustomerRolesController.update);
router.patch("/:id", requirePermission("customers.manage"), CustomerRolesController.update);
router.delete("/:id", requirePermission("customers.manage"), CustomerRolesController.remove);

export default router;
