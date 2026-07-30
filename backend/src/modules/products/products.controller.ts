import { Response } from "express";
import { asyncHandler, ApiResponse, AppError } from "../../utils/apiResponse";
import { AuthRequest } from "../../middleware/auth.middleware";
import { prisma } from "../../config/database";
import * as ProductService from "./products.service";
import * as PricingService from "../pricing/pricing.service";
import { removeTempFile } from "../../utils/spreadsheet";

export const list = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await ProductService.listProducts(req.query as never);
  return ApiResponse.paginated(res, "Products fetched.", result.data, {
    page: result.page,
    limit: result.limit,
    total: result.total,
  });
});

export const getOne = asyncHandler(async (req: AuthRequest, res: Response) => {
  const product = await ProductService.getProduct(req.params.id as string);
  return ApiResponse.success(res, "Product fetched.", product);
});

export const create = asyncHandler(async (req: AuthRequest, res: Response) => {
  const product = await ProductService.createProduct(req.body);

  await prisma.activityLog.create({
    data: { userId: req.user!.id, action: "PRODUCT_CREATED", entityType: "Product", entityId: product.id },
  });

  return ApiResponse.created(res, "Product created.", product);
});

export const update = asyncHandler(async (req: AuthRequest, res: Response) => {
  const product = await ProductService.updateProduct(req.params.id as string, req.body);

  await prisma.activityLog.create({
    data: { userId: req.user!.id, action: "PRODUCT_UPDATED", entityType: "Product", entityId: product.id },
  });

  return ApiResponse.success(res, "Product updated.", product);
});

export const remove = asyncHandler(async (req: AuthRequest, res: Response) => {
  await ProductService.deleteProduct(req.params.id as string);
  return ApiResponse.success(res, "Product deleted.");
});

export const archive = asyncHandler(async (req: AuthRequest, res: Response) => {
  const product = await ProductService.archiveProduct(req.params.id as string);
  return ApiResponse.success(res, "Product archived.", product);
});

export const restore = asyncHandler(async (req: AuthRequest, res: Response) => {
  const product = await ProductService.restoreProduct(req.params.id as string);
  return ApiResponse.success(res, "Product restored.", product);
});

export const duplicate = asyncHandler(async (req: AuthRequest, res: Response) => {
  const product = await ProductService.duplicateProduct(req.params.id as string);
  return ApiResponse.created(res, "Product duplicated.", product);
});

export const exportSpreadsheet = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ids = typeof req.query.ids === "string" ? req.query.ids.split(",").map((id) => id.trim()).filter(Boolean) : undefined;
  const buffer = await ProductService.exportProductsSpreadsheet({ ...req.query, ids } as never);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="products-export-${Date.now()}.xlsx"`);
  return res.status(200).send(buffer);
});

export const reorder = asyncHandler(async (req: AuthRequest, res: Response) => {
  const products = await ProductService.reorderProducts(req.body?.items);
  return ApiResponse.success(res, "Products reordered.", products);
});

export const bulkUpdate = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await ProductService.bulkUpdateProducts(req.body);
  return ApiResponse.success(res, "Bulk product action completed.", result);
});

export const listCountries = asyncHandler(async (req: AuthRequest, res: Response) => {
  const countries = await ProductService.listProductCountries(req.params.id as string);
  return ApiResponse.success(res, "Product countries fetched.", countries);
});

export const listVariants = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await ProductService.listVariants(req.query as never);
  return ApiResponse.paginated(res, "Variants fetched.", result.data, {
    page: result.page,
    limit: result.limit,
    total: result.total,
  });
});

export const updateCountries = asyncHandler(async (req: AuthRequest, res: Response) => {
  const items = Array.isArray(req.body) ? req.body : req.body?.items;
  const countries = await ProductService.updateProductCountries(req.params.id as string, items);
  return ApiResponse.success(res, "Product countries updated.", countries);
});

export const listVariantCountries = asyncHandler(async (req: AuthRequest, res: Response) => {
  const countries = await ProductService.listVariantCountries(req.params.id as string, req.params.variantId as string);
  return ApiResponse.success(res, "Variant countries fetched.", countries);
});

export const updateVariantCountries = asyncHandler(async (req: AuthRequest, res: Response) => {
  const items = Array.isArray(req.body) ? req.body : req.body?.items;
  const countries = await ProductService.updateVariantCountries(req.params.id as string, req.params.variantId as string, items);
  return ApiResponse.success(res, "Variant countries updated.", countries);
});

export const createPackage = asyncHandler(async (req: AuthRequest, res: Response) => {
  const pkg = await ProductService.createPackage(req.params.id as string, req.body);
  return ApiResponse.created(res, "Package created.", pkg);
});

export const updatePackage = asyncHandler(async (req: AuthRequest, res: Response) => {
  const pkg = await ProductService.updatePackage(req.params.id as string, req.params.packageId as string, req.body);
  return ApiResponse.success(res, "Package updated.", pkg);
});

export const deletePackage = asyncHandler(async (req: AuthRequest, res: Response) => {
  await ProductService.deletePackage(req.params.id as string, req.params.packageId as string);
  return ApiResponse.success(res, "Package deleted.");
});

export const uploadMedia = asyncHandler(async (req: AuthRequest, res: Response) => {
  const files = req.files as Express.Multer.File[];
  const altTexts = (req.body.altTexts || []) as string[];
  await ProductService.addProductMedia(req.params.id as string, files, altTexts);
  return ApiResponse.success(res, "Media uploaded.");
});

export const removeMedia = asyncHandler(async (req: AuthRequest, res: Response) => {
  await ProductService.deleteProductMedia(req.params.mediaId as string);
  return ApiResponse.success(res, "Media deleted.");
});

export const listAttribs = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await ProductService.listProductAttributes(req.params.id as string);
  return ApiResponse.success(res, "Product attributes fetched.", result);
});

export const assignAttribs = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await ProductService.assignAttributes(req.params.id as string, req.body.attributes);
  return ApiResponse.success(res, "Attributes assigned.", result);
});

export const removeAttrib = asyncHandler(async (req: AuthRequest, res: Response) => {
  await ProductService.removeProductAttribute(req.params.id as string, req.params.attributeId as string);
  return ApiResponse.success(res, "Attribute unmapped.");
});

export const genVariants = asyncHandler(async (req: AuthRequest, res: Response) => {
  const variants = await ProductService.generateVariants(req.params.id as string, req.body);

  const basePrice = req.body.basePrice != null ? Number(req.body.basePrice) : NaN;
  if (Number.isFinite(basePrice) && basePrice > 0) {
    const variantBasePrices =
      req.body.variantBasePrices && typeof req.body.variantBasePrices === "object"
        ? (req.body.variantBasePrices as Record<string, number>)
        : undefined;
    await PricingService.generateCountryPrices(
      req.params.id as string,
      {
        mrp: basePrice,
        variantOverrides: variantBasePrices
          ? Object.entries(variantBasePrices).reduce((acc, [variantId, price]) => {
              acc[variantId] = { mrp: price };
              return acc;
            }, {} as Record<string, { mrp: number }>)
          : undefined,
      },
    );
  }

  return ApiResponse.success(res, `${variants.length} variants generated.`, variants);
});

export const getVariants = asyncHandler(async (req: AuthRequest, res: Response) => {
  const product = await ProductService.getProduct(req.params.id as string);
  return ApiResponse.success(res, "Variants fetched.", product.variants);
});

export const createVariant = asyncHandler(async (req: AuthRequest, res: Response) => {
  const variant = await ProductService.createVariant(req.params.id as string, req.body);
  return ApiResponse.created(res, "Variant created.", variant);
});

export const updateVariant = asyncHandler(async (req: AuthRequest, res: Response) => {
  const variant = await ProductService.updateVariant(req.params.id as string, req.params.variantId as string, req.body);
  return ApiResponse.success(res, "Variant updated.", variant);
});

export const bulkUpdateVariants = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await ProductService.bulkUpdateVariants(
    req.params.id as string,
    req.body?.updates,
    req.user?.id ? `admin:${req.user.id}` : "admin"
  );
  return ApiResponse.success(res, "Bulk variant update processed.", result);
});

export const exportVariantCountryPrices = asyncHandler(async (req: AuthRequest, res: Response) => {
  const countryId = typeof req.query.countryId === "string" ? req.query.countryId : "";
  if (!countryId) throw new AppError("countryId is required.", 400);
  const buffer = await ProductService.exportVariantCountryPricesSpreadsheet(req.params.id as string, countryId);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="variant-country-prices-${Date.now()}.xlsx"`);
  return res.status(200).send(buffer);
});

export const importVariantCountryPrices = asyncHandler(async (req: AuthRequest, res: Response) => {
  const file = req.file as Express.Multer.File | undefined;
  const countryId = typeof req.body?.countryId === "string" ? req.body.countryId : "";
  if (!countryId) throw new AppError("countryId is required.", 400);
  if (!file) throw new AppError("Spreadsheet file is required.", 400);

  try {
    const result = await ProductService.importVariantCountryPricesSpreadsheet(
      req.params.id as string,
      countryId,
      file.path,
      req.user?.id ? `admin:${req.user.id}` : "admin",
    );
    return ApiResponse.success(res, "Variant country prices imported.", result);
  } finally {
    removeTempFile(file.path);
  }
});

export const deleteVariant = asyncHandler(async (req: AuthRequest, res: Response) => {
  await ProductService.deleteVariant(req.params.id as string, req.params.variantId as string);
  return ApiResponse.success(res, "Variant deleted.");
});

export const archiveVariant = asyncHandler(async (req: AuthRequest, res: Response) => {
  const variant = await ProductService.archiveVariant(req.params.id as string, req.params.variantId as string);
  return ApiResponse.success(res, "Variant archived.", variant);
});

export const restoreVariant = asyncHandler(async (req: AuthRequest, res: Response) => {
  const variant = await ProductService.restoreVariant(req.params.id as string, req.params.variantId as string);
  return ApiResponse.success(res, "Variant restored.", variant);
});

export const cloneVariant = asyncHandler(async (req: AuthRequest, res: Response) => {
  const variant = await ProductService.cloneVariant(req.params.id as string, req.params.variantId as string);
  return ApiResponse.created(res, "Variant cloned.", variant);
});

export const listTierPricing = asyncHandler(async (req: AuthRequest, res: Response) => {
  const rules = await ProductService.listTierPricing(req.params.id as string);
  return ApiResponse.success(res, "Tier pricing rules fetched.", rules);
});

export const createTierPricing = asyncHandler(async (req: AuthRequest, res: Response) => {
  const rule = await ProductService.createTierPricing(req.params.id as string, req.body);
  return ApiResponse.created(res, "Tier pricing rule created.", rule);
});

export const updateTierPricing = asyncHandler(async (req: AuthRequest, res: Response) => {
  const rule = await ProductService.updateTierPricing(req.params.id as string, req.params.ruleId as string, req.body);
  return ApiResponse.success(res, "Tier pricing rule updated.", rule);
});

export const deleteTierPricing = asyncHandler(async (req: AuthRequest, res: Response) => {
  await ProductService.deleteTierPricing(req.params.id as string, req.params.ruleId as string);
  return ApiResponse.success(res, "Tier pricing rule deleted.");
});

export const listMoqPricing = asyncHandler(async (req: AuthRequest, res: Response) => {
  const rules = await ProductService.listMoqPricing(req.params.id as string);
  return ApiResponse.success(res, "MOQ pricing rules fetched.", rules);
});

export const createMoqPricing = asyncHandler(async (req: AuthRequest, res: Response) => {
  const rule = await ProductService.createMoqPricing(req.params.id as string, req.body);
  return ApiResponse.created(res, "MOQ pricing rule created.", rule);
});

export const updateMoqPricing = asyncHandler(async (req: AuthRequest, res: Response) => {
  const rule = await ProductService.updateMoqPricing(req.params.id as string, req.params.ruleId as string, req.body);
  return ApiResponse.success(res, "MOQ pricing rule updated.", rule);
});

export const deleteMoqPricing = asyncHandler(async (req: AuthRequest, res: Response) => {
  await ProductService.deleteMoqPricing(req.params.id as string, req.params.ruleId as string);
  return ApiResponse.success(res, "MOQ pricing rule deleted.");
});

export const previewImport = asyncHandler(async (req: AuthRequest, res: Response) => {
  const file = req.file as Express.Multer.File | undefined;
  if (!file) return ApiResponse.success(res, "No file uploaded.", { totalRows: 0, validRows: 0, invalidRows: 0, issues: ["No spreadsheet file provided."] });

  try {
    const report = await ProductService.previewProductImport(file.path);
    return ApiResponse.success(res, "Import preview generated.", report);
  } finally {
    removeTempFile(file.path);
  }
});

export const importSpreadsheet = asyncHandler(async (req: AuthRequest, res: Response) => {
  const file = req.file as Express.Multer.File | undefined;
  if (!file) return ApiResponse.success(res, "No file uploaded.", { created: 0, updated: 0, report: { totalRows: 0, validRows: 0, invalidRows: 0, issues: ["No spreadsheet file provided."], duplicateWarnings: [], sampleRows: [] } });

  try {
    const result = await ProductService.importProductsSpreadsheet(file.path);
    return ApiResponse.success(res, "Products imported successfully.", result);
  } finally {
    removeTempFile(file.path);
  }
});
