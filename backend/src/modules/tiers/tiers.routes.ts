import { Router } from "express";
import { protect } from "../../middleware/auth.middleware";
import * as C from "./tiers.controller";

const router = Router();
router.use(protect);

router.get("/", C.list);

export default router;
