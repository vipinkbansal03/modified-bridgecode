import { Router } from "express";
import { protect, requirePermission } from "../../middleware/auth.middleware";
import * as C from "./users.controller";

const router = Router();

router.use(protect, requirePermission("users.manage"));
router.get("/", C.list);
router.post("/", C.create);
router.put("/:id", C.update);
router.delete("/:id", C.remove);

export default router;
