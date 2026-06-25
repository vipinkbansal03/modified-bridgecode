import { Response } from "express";
import { asyncHandler, ApiResponse, AppError } from "../../utils/apiResponse";
import { AuthRequest } from "../../middleware/auth.middleware";
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
