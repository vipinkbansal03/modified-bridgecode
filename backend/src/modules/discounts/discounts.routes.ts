import { Router } from "express";
import { protect, requirePermission } from "../../middleware/auth.middleware";
import * as DiscountsController from "./discounts.controller";

const router = Router();

router.use(protect);
router.get("/", requirePermission("discounts.view", "discounts.manage"), DiscountsController.list);
router.post("/", requirePermission("discounts.manage"), DiscountsController.create);
router.put("/:id", requirePermission("discounts.manage"), DiscountsController.update);
router.delete("/:id", requirePermission("discounts.manage"), DiscountsController.remove);

export default router;
