import { Response } from "express";
import { asyncHandler, ApiResponse } from "../../utils/apiResponse";
import { removeTempFile } from "../../utils/spreadsheet";
import { AuthRequest } from "../../middleware/auth.middleware";
import * as TaxService from "./tax.service";

export const list = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await TaxService.listTaxRules(req.query as never);
  return ApiResponse.paginated(res, "Tax rules fetched.", result.data, {
    page: result.page,
    limit: result.limit,
    total: result.total,
  });
});

export const dashboard = asyncHandler(async (_req: AuthRequest, res: Response) => {
  return ApiResponse.success(res, "Tax dashboard fetched.", await TaxService.getTaxDashboard());
});

export const preview = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await TaxService.previewTaxImpact({
    countryId: typeof req.query.countryId === "string" ? req.query.countryId : undefined,
    subtotal: typeof req.query.subtotal === "string" || typeof req.query.subtotal === "number" ? req.query.subtotal : undefined,
  });
  return ApiResponse.success(res, "Tax preview generated.", result);
});

export const create = asyncHandler(async (req: AuthRequest, res: Response) => {
  const rule = await TaxService.createTaxRule(req.body);
  return ApiResponse.created(res, "Tax rule created.", rule);
});

export const update = asyncHandler(async (req: AuthRequest, res: Response) => {
  const rule = await TaxService.updateTaxRule(req.params.id, req.body);
  return ApiResponse.success(res, "Tax rule updated.", rule);
});

export const remove = asyncHandler(async (req: AuthRequest, res: Response) => {
  await TaxService.deleteTaxRule(req.params.id);
  return ApiResponse.success(res, "Tax rule deleted.");
});

export const bulk = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await TaxService.bulkUpdateTaxRules(req.body);
  return ApiResponse.success(res, "Tax rules updated.", result);
});

export const exportSpreadsheet = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ids = typeof req.query.ids === "string" ? req.query.ids : undefined;
  const buffer = await TaxService.exportTaxSpreadsheet({ ...(req.query as Record<string, string | undefined>), ids });
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="tax-rules-export-${Date.now()}.xlsx"`);
  return res.status(200).send(buffer);
});

export const previewImport = asyncHandler(async (req: AuthRequest, res: Response) => {
  const file = req.file as Express.Multer.File | undefined;
  if (!file) {
    return ApiResponse.success(res, "No file uploaded.", {
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      issues: ["No spreadsheet file provided."],
      duplicateWarnings: [],
      sampleRows: [],
    });
  }

  try {
    const report = await TaxService.previewTaxImport(file.path);
    return ApiResponse.success(res, "Import preview generated.", report);
  } finally {
    removeTempFile(file.path);
  }
});

export const importSpreadsheet = asyncHandler(async (req: AuthRequest, res: Response) => {
  const file = req.file as Express.Multer.File | undefined;
  if (!file) {
    return ApiResponse.success(res, "No file uploaded.", {
      created: 0,
      updated: 0,
      report: {
        totalRows: 0,
        validRows: 0,
        invalidRows: 0,
        issues: ["No spreadsheet file provided."],
        duplicateWarnings: [],
        sampleRows: [],
      },
    });
  }

  try {
    const result = await TaxService.importTaxSpreadsheet(file.path);
    return ApiResponse.success(res, "Tax rules imported successfully.", result);
  } finally {
    removeTempFile(file.path);
  }
});

export const validateIdentifier = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { taxId, taxIdType, countryCode } = req.body;
  if (!taxId) {
    return ApiResponse.error(res, "Tax ID is required.", [], 400);
  }
  const result = await TaxService.validateTaxIdentifier(
    String(taxId),
    String(taxIdType || ""),
    String(countryCode || "")
  );
  return ApiResponse.success(res, "Tax identifier validation completed.", result);
});

export const validateAddress = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await TaxService.validateAddressDetails(req.body);
  return ApiResponse.success(res, "Address validation completed.", result);
});

