import { Router } from "express";
import { protect, requirePermission } from "../../middleware/auth.middleware";
import * as C from "./banners.controller";

const router = Router();
router.use(protect);

router.get("/", requirePermission("cms.view", "cms.manage"), C.list);
router.post("/", requirePermission("cms.manage"), C.create);
router.post("/bulk", requirePermission("cms.manage"), C.bulk);
router.put("/reorder", requirePermission("cms.manage"), C.reorder);
router.get("/:id", requirePermission("cms.view", "cms.manage"), C.getOne);
router.put("/:id", requirePermission("cms.manage"), C.update);
router.delete("/:id", requirePermission("cms.manage"), C.remove);

export default router;
