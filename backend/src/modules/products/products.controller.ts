import fs from "fs";
import Papa from "papaparse";
import { Response } from "express";
import { asyncHandler, ApiResponse } from "../../utils/apiResponse";
import { AuthRequest } from "../../middleware/auth.middleware";
import * as ProductService from "./products.service";
import { prisma } from "../../config/database";
import { slugify } from "../../utils/apiResponse";

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

export const deleteVariant = asyncHandler(async (req: AuthRequest, res: Response) => {
  await ProductService.deleteVariant(req.params.id as string, req.params.variantId as string);
  return ApiResponse.success(res, "Variant deleted.");
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

export const importCsv = asyncHandler(async (req: AuthRequest, res: Response) => {
  const file = req.file as Express.Multer.File | undefined;
  if (!file) return ApiResponse.success(res, "No file uploaded.", { created: 0, updated: 0, errors: ["No CSV file provided."] });

  const csvText = fs.readFileSync(file.path, "utf-8");
  fs.unlinkSync(file.path);

  const { data, errors: parseErrors } = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  if (parseErrors.length) {
    return ApiResponse.success(res, "CSV parse error.", { created: 0, updated: 0, errors: parseErrors.map((e) => e.message) });
  }

  let created = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const row of data) {
    try {
      const { title, productCode, categoryId, sku, brand, shortDescription, description, status, isFeatured } = row;
      if (!title || !categoryId) {
        errors.push(`Row missing title or categoryId: ${JSON.stringify(row)}`);
        continue;
      }

      const existing = productCode
        ? await prisma.product.findFirst({ where: { productCode, deletedAt: null } })
        : null;

      if (existing) {
        await prisma.product.update({
          where: { id: existing.id },
          data: { title, sku: sku || undefined, brand: brand || undefined, shortDescription: shortDescription || undefined, description: description || undefined, status: (status as never) || "DRAFT", isFeatured: isFeatured === "true" },
        });
        updated++;
      } else {
        const slug = slugify(title);
        const existing2 = await prisma.product.findUnique({ where: { slug } });
        await prisma.product.create({
          data: {
            title,
            slug: existing2 ? `${slug}-${Date.now()}` : slug,
            productCode: productCode || undefined,
            categoryId,
            sku: sku || undefined,
            brand: brand || "Modern Orthodontics",
            shortDescription: shortDescription || undefined,
            description: description || undefined,
            status: (status as never) || "DRAFT",
            isFeatured: isFeatured === "true",
          },
        });
        created++;
      }
    } catch (err) {
      errors.push(`Row failed: ${(err as Error).message}`);
    }
  }

  return ApiResponse.success(res, `Import complete: ${created} created, ${updated} updated.`, { created, updated, errors });
});
