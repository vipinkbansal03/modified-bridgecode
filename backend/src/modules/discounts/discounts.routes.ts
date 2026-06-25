import { Router } from "express";
import { protect } from "../../middleware/auth.middleware";
import * as DiscountsController from "./discounts.controller";

const router = Router();

router.use(protect);
router.get("/", DiscountsController.list);
router.post("/", DiscountsController.create);
router.put("/:id", DiscountsController.update);
router.delete("/:id", DiscountsController.remove);

export default router;
