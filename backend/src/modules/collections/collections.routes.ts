import { Router } from "express";
import { protect, requirePermission } from "../../middleware/auth.middleware";
import * as CollectionsController from "./collections.controller";

const router = Router();

router.use(protect);
router.get("/", requirePermission("collections.view", "collections.manage"), CollectionsController.list);
router.post("/", requirePermission("collections.manage"), CollectionsController.create);
router.get("/:id", requirePermission("collections.view", "collections.manage"), CollectionsController.getOne);
router.put("/:id", requirePermission("collections.manage"), CollectionsController.update);
router.delete("/:id", requirePermission("collections.manage"), CollectionsController.remove);
router.post("/:id/archive", requirePermission("collections.manage"), CollectionsController.archive);
router.post("/:id/restore", requirePermission("collections.manage"), CollectionsController.restore);
router.post("/:id/duplicate", requirePermission("collections.manage"), CollectionsController.duplicate);
router.get("/:id/countries", requirePermission("collections.view", "collections.manage"), CollectionsController.listCountries);
router.put("/:id/countries", requirePermission("collections.manage"), CollectionsController.updateCountries);
router.get("/:id/discounts", requirePermission("collections.view", "collections.manage"), CollectionsController.listDiscounts);
router.post("/:id/discounts", requirePermission("collections.manage"), CollectionsController.createDiscount);
router.delete("/:id/discounts/:discountId", requirePermission("collections.manage"), CollectionsController.removeDiscount);

export default router;
