import { Response } from "express";
import { prisma } from "../../config/database";
import { AuthRequest } from "../../middleware/auth.middleware";
import { asyncHandler, ApiResponse, AppError } from "../../utils/apiResponse";
import * as S from "./pricing.service";
import { removeTempFile } from "../../utils/spreadsheet";

export const dashboard = asyncHandler(async (_req: AuthRequest, res: Response) => {
  return ApiResponse.success(res, "Pricing dashboard fetched.", await S.getPricingDashboard());
});

export const list = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = (await S.listPricing(req.query as never)) as {
    data: unknown[];
    page: number;
    limit: number;
    total: number;
  };
  return ApiResponse.paginated(res, "Pricing fetched.", result.data, {
    page: result.page,
    limit: result.limit,
    total: result.total,
  });
});

export const create = asyncHandler(async (req: AuthRequest, res: Response) => {
  const price = await S.createPrice(req.body);
  await prisma.activityLog.create({
    data: { userId: req.user!.id, action: "PRICING_CREATED", entityType: "Pricing", entityId: price.id },
  });
  return ApiResponse.created(res, "Price created.", price);
});

export const update = asyncHandler(async (req: AuthRequest, res: Response) => {
  const price = await S.updatePrice(String(req.params.id), req.body);
  await prisma.activityLog.create({
    data: { userId: req.user!.id, action: "PRICING_UPDATED", entityType: "Pricing", entityId: price.id },
  });
  return ApiResponse.success(res, "Price updated.", price);
});

export const remove = asyncHandler(async (req: AuthRequest, res: Response) => {
  await S.deletePrice(String(req.params.id));
  return ApiResponse.success(res, "Price deleted.");
});

export const duplicate = asyncHandler(async (req: AuthRequest, res: Response) => {
  const price = await S.duplicatePrice(String(req.params.id));
  return ApiResponse.created(res, "Price duplicated.", price);
});

export const bulk = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await S.bulkUpdatePricing(req.body);
  return ApiResponse.success(res, "Bulk pricing action completed.", result);
});

export const generateForCountries = asyncHandler(async (req: AuthRequest, res: Response) => {
  const input = req.body;
  const productId = String(input.productId || req.query.productId || "").trim();
  if (!productId) {
    throw new AppError("Product ID is required to generate country prices.", 400);
  }
  const count = await S.generateCountryPrices(productId, input);
  return ApiResponse.success(res, `${count.generated} country prices generated.`, count);
});

export const preview = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await S.previewPricing({
    productId: String(req.query.productId || ""),
    variantId: req.query.variantId ? String(req.query.variantId) : null,
    countryId: String(req.query.countryId || ""),
    quantity: Number(req.query.quantity || 1),
    customerId: req.query.customerId ? String(req.query.customerId) : null,
    customerRoleKey: req.query.customerRoleKey ? String(req.query.customerRoleKey) : null,
    tierId: req.query.tierId ? String(req.query.tierId) : null,
  });
  return ApiResponse.success(res, "Pricing preview generated.", result);
});

export const exportSpreadsheet = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ids = typeof req.query.ids === "string" ? req.query.ids.split(",").map((id) => id.trim()).filter(Boolean) : undefined;
  const query = req.query as Record<string, string | undefined>;
  const buffer = await S.exportPricingSpreadsheet({ ...query, ids });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="pricing-export-${Date.now()}.xlsx"`);
  return res.status(200).send(buffer);
});

export const previewImport = asyncHandler(async (req: AuthRequest, res: Response) => {
  const file = req.file as Express.Multer.File | undefined;
  if (!file) return ApiResponse.success(res, "No file uploaded.", { totalRows: 0, validRows: 0, invalidRows: 0, issues: [], duplicateWarnings: [], sampleRows: [] });

  try {
    const report = await S.previewPricingImport(file.path);
    return ApiResponse.success(res, "Import preview generated.", report);
  } finally {
    removeTempFile(file.path);
  }
});

export const importSpreadsheet = asyncHandler(async (req: AuthRequest, res: Response) => {
  const file = req.file as Express.Multer.File | undefined;
  if (!file) return ApiResponse.success(res, "No file uploaded.", { created: 0, updated: 0, report: { totalRows: 0, validRows: 0, invalidRows: 0, issues: [], duplicateWarnings: [], sampleRows: [] } });

  try {
    const result = await S.importPricingSpreadsheet(file.path);
    return ApiResponse.success(res, "Pricing imported successfully.", result);
  } finally {
    removeTempFile(file.path);
  }
});

export const createTierPricing = asyncHandler(async (req: AuthRequest, res: Response) => {
  const rule = await S.createTierPricing(req.params.id as string, req.body);
  return ApiResponse.created(res, "Tier pricing rule created.", rule);
});

export const updateTierPricing = asyncHandler(async (req: AuthRequest, res: Response) => {
  const rule = await S.updateTierPricing(req.params.id as string, req.params.ruleId as string, req.body);
  return ApiResponse.success(res, "Tier pricing rule updated.", rule);
});

export const deleteTierPricing = asyncHandler(async (req: AuthRequest, res: Response) => {
  await S.deleteTierPricing(req.params.id as string, req.params.ruleId as string);
  return ApiResponse.success(res, "Tier pricing rule deleted.");
});

export const createMoqPricing = asyncHandler(async (req: AuthRequest, res: Response) => {
  const rule = await S.createMoqPricing(req.params.id as string, req.body);
  return ApiResponse.created(res, "MOQ pricing rule created.", rule);
});

export const updateMoqPricing = asyncHandler(async (req: AuthRequest, res: Response) => {
  const rule = await S.updateMoqPricing(req.params.id as string, req.params.ruleId as string, req.body);
  return ApiResponse.success(res, "MOQ pricing rule updated.", rule);
});

export const deleteMoqPricing = asyncHandler(async (req: AuthRequest, res: Response) => {
  await S.deleteMoqPricing(req.params.id as string, req.params.ruleId as string);
  return ApiResponse.success(res, "MOQ pricing rule deleted.");
});
