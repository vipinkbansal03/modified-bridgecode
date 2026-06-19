import { Router } from "express";
import { protect, requirePermission } from "../../middleware/auth.middleware";
import { upload } from "../../middleware/upload.middleware";
import * as C from "./products.controller";

const router = Router();
router.use(protect);

router.get("/", C.list);
router.post("/", requirePermission("products.create"), C.create);
router.get("/:id", C.getOne);
router.put("/:id", requirePermission("products.update"), C.update);
router.delete("/:id", requirePermission("products.delete"), C.remove);

router.post("/:id/media", requirePermission("products.update"), upload.array("files", 10), C.uploadMedia);
router.delete("/:id/media/:mediaId", requirePermission("products.update"), C.removeMedia);

router.post("/:id/attributes", requirePermission("products.update"), C.assignAttribs);
router.post("/:id/generate-variants", requirePermission("products.update"), C.genVariants);
router.get("/:id/variants", C.getVariants);

export default router;
