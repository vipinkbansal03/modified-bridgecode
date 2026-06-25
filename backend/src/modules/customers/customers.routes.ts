import { Router } from "express";
import { protect } from "../../middleware/auth.middleware";
import * as C from "./customers.controller";

const router = Router();
router.use(protect);

router.get("/", C.list);
router.get("/:id", C.getOne);
router.put("/:id/tier", C.updateTier);

export default router;
