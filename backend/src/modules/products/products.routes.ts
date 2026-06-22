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
router.post("/:id/packages", requirePermission("products.update"), C.createPackage);
router.put("/:id/packages/:packageId", requirePermission("products.update"), C.updatePackage);
router.delete("/:id/packages/:packageId", requirePermission("products.update"), C.deletePackage);

router.post("/:id/media", requirePermission("products.update"), upload.array("files", 10), C.uploadMedia);
router.delete("/:id/media/:mediaId", requirePermission("products.update"), C.removeMedia);

router.post("/:id/attributes", requirePermission("products.update"), C.assignAttribs);
router.post("/:id/generate-variants", requirePermission("products.update"), C.genVariants);
router.get("/:id/variants", C.getVariants);
router.post("/:id/variants", requirePermission("products.update"), C.createVariant);
router.put("/:id/variants/:variantId", requirePermission("products.update"), C.updateVariant);
router.delete("/:id/variants/:variantId", requirePermission("products.update"), C.deleteVariant);
router.post("/:id/variants/:variantId/clone", requirePermission("products.update"), C.cloneVariant);

router.post("/import", requirePermission("products.create"), upload.single("file"), C.importCsv);

export default router;
