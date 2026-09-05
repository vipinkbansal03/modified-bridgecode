import { Response } from "express";
import { asyncHandler, ApiResponse, AppError } from "../../utils/apiResponse";
import { AuthRequest } from "../../middleware/auth.middleware";
import { removeTempFile } from "../../utils/spreadsheet";
import * as S from "./attributes.service";
import {
  createAttributeSchema,
  createValueSchema,
  reorderSchema,
  updateAttributeSchema,
  updateValueSchema,
} from "./attributes.validation";

function parseBody<T>(schema: { safeParse: (data: unknown) => { success: boolean; error?: { issues: { message: string }[] }; data?: T } }, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new AppError(result.error!.issues.map((i) => i.message).join(" "), 400);
  }
  return result.data as T;
}

export const list = asyncHandler(async (_r: AuthRequest, res: Response) =>
  ApiResponse.success(res, "OK", await S.listAttributes()),
);

export const getOne = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "OK", await S.getAttribute(String(req.params.id))),
);

export const create = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = parseBody(createAttributeSchema, req.body);
  return ApiResponse.created(res, "Attribute created.", await S.createAttribute(data));
});

export const update = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = parseBody(updateAttributeSchema, req.body);
  return ApiResponse.success(res, "Updated.", await S.updateAttribute(String(req.params.id), data));
});

export const remove = asyncHandler(async (req: AuthRequest, res: Response) => {
  await S.deleteAttribute(String(req.params.id));
  return ApiResponse.success(res, "Deleted.");
});

export const reorder = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { items } = parseBody(reorderSchema, req.body);
  return ApiResponse.success(res, "Attributes reordered.", await S.reorderAttributes(items));
});

export const listValues = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "OK", await S.listAttributeValues(String(req.params.id))),
);

export const addValue = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = parseBody(createValueSchema, req.body);
  return ApiResponse.created(res, "Value added.", await S.addAttributeValue(String(req.params.id), data));
});

export const updateValue = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = parseBody(updateValueSchema, req.body);
  return ApiResponse.success(
    res,
    "Updated.",
    await S.updateAttributeValue(String(req.params.valueId), data),
  );
});

export const removeValue = asyncHandler(async (req: AuthRequest, res: Response) => {
  await S.deleteAttributeValue(String(req.params.valueId));
  return ApiResponse.success(res, "Deleted.");
});

export const reorderValues = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { items } = parseBody(reorderSchema, req.body);
  return ApiResponse.success(
    res,
    "Values reordered.",
    await S.reorderAttributeValues(String(req.params.id), items),
  );
});

export const exportSpreadsheet = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const buffer = await S.exportAttributesSpreadsheet();
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="attributes-export-${Date.now()}.xlsx"`);
  return res.status(200).send(buffer);
});

export const downloadSampleTemplate = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const buffer = S.generateSampleAttributesTemplate();
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="attributes-template.xlsx"`);
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
    return ApiResponse.success(res, "Import preview generated.", await S.previewAttributeImport(file.path));
  } finally {
    removeTempFile(file.path);
  }
});

export const importSpreadsheet = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (req.body?.rows && Array.isArray(req.body.rows)) {
    const result = await S.importAttributesSpreadsheet(req.body.rows);
    return ApiResponse.success(res, "Attributes imported successfully.", result);
  }

  const file = req.file as Express.Multer.File | undefined;
  if (!file) {
    return ApiResponse.success(res, "No file uploaded.", {
      createdAttributes: 0,
      updatedAttributes: 0,
      createdValues: 0,
      updatedValues: 0,
      totalProcessed: 0,
    });
  }
  try {
    return ApiResponse.success(res, "Attributes imported successfully.", await S.importAttributesSpreadsheet(file.path));
  } finally {
    removeTempFile(file.path);
  }
});