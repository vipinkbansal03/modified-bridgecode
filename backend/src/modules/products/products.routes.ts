import { Router } from "express";
import { protect, requirePermission } from "../../middleware/auth.middleware";
import { upload } from "../../middleware/upload.middleware";
import * as C from "./products.controller";

const router = Router();
router.use(protect);

router.get("/", requirePermission("products.view", "products.create", "products.update", "products.delete"), C.list);
router.post("/", requirePermission("products.create"), C.create);
router.put("/reorder", requirePermission("products.update", "products.manage"), C.reorder);
router.post("/bulk", requirePermission("products.update", "products.delete", "products.manage"), C.bulkUpdate);
router.post("/bulk/permanent", requirePermission("products.delete", "products.manage"), C.bulkPermanentDelete);
router.get("/export", requirePermission("products.view", "products.create", "products.update", "products.delete"), C.exportSpreadsheet);
router.post("/import/preview", requirePermission("products.create"), upload.single("file"), C.previewImport);
router.get("/variants", requirePermission("products.view", "products.create", "products.update", "products.delete"), C.listVariants);
router.post("/variants/bulk/permanent", requirePermission("products.delete", "products.manage"), C.bulkPermanentDeleteVariants);
router.get("/:id/countries", requirePermission("products.view", "products.create", "products.update", "products.delete"), C.listCountries);
router.put("/:id/countries", requirePermission("products.update"), C.updateCountries);
router.get("/:id/tier-pricing", requirePermission("products.view", "products.create", "products.update", "products.delete"), C.listTierPricing);
router.post("/:id/tier-pricing", requirePermission("products.update"), C.createTierPricing);
router.put("/:id/tier-pricing/:ruleId", requirePermission("products.update"), C.updateTierPricing);
router.delete("/:id/tier-pricing/:ruleId", requirePermission("products.update"), C.deleteTierPricing);
router.get("/:id/moq-pricing", requirePermission("products.view", "products.create", "products.update", "products.delete"), C.listMoqPricing);
router.post("/:id/moq-pricing", requirePermission("products.update"), C.createMoqPricing);
router.put("/:id/moq-pricing/:ruleId", requirePermission("products.update"), C.updateMoqPricing);
router.delete("/:id/moq-pricing/:ruleId", requirePermission("products.update"), C.deleteMoqPricing);
router.get("/:id", requirePermission("products.view", "products.create", "products.update", "products.delete"), C.getOne);
router.put("/:id", requirePermission("products.update"), C.update);
router.post("/:id/duplicate", requirePermission("products.update"), C.duplicate);
router.post("/:id/restore", requirePermission("products.update", "products.manage"), C.restore);
router.delete("/:id/permanent", requirePermission("products.delete", "products.manage"), C.permanentDelete);
router.delete("/:id", requirePermission("products.delete"), C.remove);
router.put("/:id/shipping-info", requirePermission("products.update"), C.updateShippingInfo);
router.post("/:id/packages", requirePermission("products.update"), C.createPackage);
router.put("/:id/packages/:packageId", requirePermission("products.update"), C.updatePackage);
router.delete("/:id/packages/:packageId", requirePermission("products.update"), C.deletePackage);

router.post("/:id/media", requirePermission("products.update"), upload.array("files", 10), C.uploadMedia);
router.put("/:id/media/:mediaId/cover", requirePermission("products.update"), C.setCoverMedia);
router.delete("/:id/media/:mediaId", requirePermission("products.update"), C.removeMedia);

router.get("/:id/attributes", requirePermission("products.view", "products.create", "products.update", "products.delete"), C.listAttribs);
router.post("/:id/attributes", requirePermission("products.update"), C.assignAttribs);
router.delete("/:id/attributes/:attributeId", requirePermission("products.update"), C.removeAttrib);
router.post("/:id/generate-variants", requirePermission("products.update"), C.genVariants);
router.get("/:id/variants", requirePermission("products.view", "products.create", "products.update", "products.delete"), C.getVariants);
router.put("/:id/variants/bulk", requirePermission("products.update"), C.bulkUpdateVariants);
router.get("/:id/variants/prices/export", requirePermission("products.view", "products.create", "products.update", "products.delete"), C.exportVariantCountryPrices);
router.post("/:id/variants/prices/import", requirePermission("products.update"), upload.single("file"), C.importVariantCountryPrices);
router.post("/:id/variants/import-preview", requirePermission("products.update"), upload.single("file"), C.previewVariantsImport);
router.post("/:id/variants/import-execute", requirePermission("products.update"), C.executeVariantsImport);
router.post("/:id/variants", requirePermission("products.update"), C.createVariant);
router.get("/:id/variants/:variantId/countries", requirePermission("products.view", "products.create", "products.update", "products.delete"), C.listVariantCountries);
router.put("/:id/variants/:variantId/countries", requirePermission("products.update"), C.updateVariantCountries);
router.put("/:id/variants/:variantId", requirePermission("products.update"), C.updateVariant);
router.post("/:id/variants/:variantId/restore", requirePermission("products.update", "products.manage"), C.restoreVariant);
router.delete("/:id/variants/:variantId/permanent", requirePermission("products.delete", "products.manage"), C.permanentDeleteVariant);
router.delete("/:id/variants/:variantId", requirePermission("products.update", "products.delete"), C.deleteVariant);
router.post("/:id/variants/:variantId/clone", requirePermission("products.update"), C.cloneVariant);

router.post("/import", requirePermission("products.create"), upload.single("file"), C.importSpreadsheet);

export default router;
