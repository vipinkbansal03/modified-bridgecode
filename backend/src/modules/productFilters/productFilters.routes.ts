import { Router } from "express";
import { protect, requirePermission } from "../../middleware/auth.middleware";
import * as C from "./productFilters.controller";

const router = Router();

router.get("/", protect, requirePermission("attributes.view", "attributes.manage"), C.get);
router.put("/", protect, requirePermission("attributes.manage"), C.update);

router.get("/:id/visibility", protect, requirePermission("products.view", "products.update"), C.getVisibility);
router.put("/:id/visibility", protect, requirePermission("products.update"), C.setVisibility);

router.get("/public", C.publicConfig);

export default router;