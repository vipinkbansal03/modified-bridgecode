import { Router } from "express";
import { protect, requirePermission } from "../../middleware/auth.middleware";
import * as C from "./attributes.controller";

const router = Router();
router.use(protect);

router.get("/", requirePermission("attributes.view", "attributes.manage"), C.list);
router.post("/", requirePermission("attributes.manage"), C.create);
router.put("/reorder", requirePermission("attributes.manage"), C.reorder);

router.get("/:id", requirePermission("attributes.view", "attributes.manage"), C.getOne);
router.put("/:id", requirePermission("attributes.manage"), C.update);
router.delete("/:id", requirePermission("attributes.manage"), C.remove);

router.get("/:id/values", requirePermission("attributes.view", "attributes.manage"), C.listValues);
router.put("/:id/values/reorder", requirePermission("attributes.manage"), C.reorderValues);
router.post("/:id/values", requirePermission("attributes.manage"), C.addValue);
router.put("/:id/values/:valueId", requirePermission("attributes.manage"), C.updateValue);
router.delete("/:id/values/:valueId", requirePermission("attributes.manage"), C.removeValue);

export default router;
