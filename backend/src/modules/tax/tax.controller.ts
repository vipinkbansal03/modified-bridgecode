import { Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../../config/database";
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

export const downloadSampleTemplate = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const buffer = TaxService.generateSampleTaxTemplate();
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="tax-rules-template.xlsx"');
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
  const rows = req.body?.rows;
  if (Array.isArray(rows) && rows.length > 0) {
    const result = await TaxService.importTaxSpreadsheet(rows);
    return ApiResponse.success(res, "Tax rules imported successfully.", result);
  }

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

  let customerId: string | null = null;
  let token: string | undefined;
  if (req.headers.authorization?.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies?.customerToken) {
    token = req.cookies.customerToken;
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { id: string; scope?: string };
      if (decoded.scope === "customer") {
        customerId = decoded.id;
      }
    } catch (err) {
      // ignore
    }
  }

  if (!taxId) {
    if (customerId) {
      await prisma.customer.update({
        where: { id: customerId },
        data: {
          taxId: null,
          taxIdType: null,
          taxIdStatus: "UNVERIFIED",
          vatNumber: null,
          vatValidationStatus: "UNVERIFIED",
          vatValidatedAt: null,
          vatCompanyName: null,
          vatCompanyAddress: null,
          vatCountryCode: null,
          vatValidationSource: null,
        },
      });
    }
    return ApiResponse.success(res, "Tax identifier cleared.", {
      success: true,
      valid: false,
      message: "Tax ID cleared.",
      isValid: false,
    });
  }

  const result = (await TaxService.validateTaxIdentifier(
    String(taxId),
    String(taxIdType || ""),
    String(countryCode || "")
  )) as any;

  const normalizedResult = {
    success: true,
    valid: Boolean(result.isValid),
    countryCode: result.countryCode ?? String(countryCode || "").toUpperCase(),
    identifier: result.identifier ?? result.taxId ?? String(taxId),
    identifierType: result.identifierType ?? String(taxIdType || "").toUpperCase(),
    validationStatus: result.validationStatus ?? (result.isValid ? "VALID" : "INVALID"),
    validationSource: result.validationSource ?? result.validatedBy ?? null,
    companyName: result.companyName ?? result.legalName ?? null,
    address: result.companyAddress ?? result.address ?? null,
    message: result.message ?? (result.isValid ? "Tax identifier verified successfully" : "Invalid tax identifier"),
    isValid: Boolean(result.isValid),
    ...result,
  };

  const isVatIdentifier = normalizedResult.identifierType === "VAT";
  const vatFields = isVatIdentifier
    ? {
        vatNumber: normalizedResult.identifier ?? null,
        vatValidationStatus: normalizedResult.isValid ? "VALID" : "INVALID",
        vatValidatedAt: normalizedResult.isValid ? new Date() : null,
        vatCompanyName: normalizedResult.companyName ?? null,
        vatCompanyAddress: normalizedResult.address ?? null,
        vatCountryCode: normalizedResult.countryCode ?? null,
        vatValidationSource: normalizedResult.validationSource ?? null,
      }
    : {
        vatNumber: null,
        vatValidationStatus: null,
        vatValidatedAt: null,
        vatCompanyName: null,
        vatCompanyAddress: null,
        vatCountryCode: null,
        vatValidationSource: null,
      };

  if (customerId) {
    await prisma.customer.update({
      where: { id: customerId },
      data: {
        taxId: normalizedResult.isValid ? normalizedResult.identifier ?? String(taxId) : String(taxId),
        taxIdType: normalizedResult.isValid ? normalizedResult.identifierType : String(taxIdType || ""),
        taxIdStatus: normalizedResult.validationStatus || (normalizedResult.isValid ? "VALID" : "INVALID"),
        taxIdVerifiedAt: normalizedResult.isValid ? new Date() : null,
        ...vatFields,
      },
    });
  }

  return ApiResponse.success(res, "Tax identifier validation completed.", normalizedResult);
});

export const validateAddress = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await TaxService.validateAddressDetails(req.body);
  return ApiResponse.success(res, "Address validation completed.", result);
});

