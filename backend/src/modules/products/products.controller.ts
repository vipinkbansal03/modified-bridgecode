import { Response } from "express";
import { asyncHandler, ApiResponse } from "../../utils/apiResponse";
import { AuthRequest } from "../../middleware/auth.middleware";
import * as ProductService from "./products.service";
import { prisma } from "../../config/database";

export const list = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await ProductService.listProducts(req.query as never);
  return ApiResponse.paginated(res, "Products fetched.", result.data, {
    page: result.page,
    limit: result.limit,
    total: result.total,
  });
});

export const getOne = asyncHandler(async (req: AuthRequest, res: Response) => {
  const product = await ProductService.getProduct(req.params.id);
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
  const product = await ProductService.updateProduct(req.params.id, req.body);

  await prisma.activityLog.create({
    data: { userId: req.user!.id, action: "PRODUCT_UPDATED", entityType: "Product", entityId: product.id },
  });

  return ApiResponse.success(res, "Product updated.", product);
});

export const remove = asyncHandler(async (req: AuthRequest, res: Response) => {
  await ProductService.deleteProduct(req.params.id);
  return ApiResponse.success(res, "Product deleted.");
});

export const uploadMedia = asyncHandler(async (req: AuthRequest, res: Response) => {
  const files = req.files as Express.Multer.File[];
  const altTexts = (req.body.altTexts || []) as string[];
  await ProductService.addProductMedia(req.params.id, files, altTexts);
  return ApiResponse.success(res, "Media uploaded.");
});

export const removeMedia = asyncHandler(async (req: AuthRequest, res: Response) => {
  await ProductService.deleteProductMedia(req.params.mediaId);
  return ApiResponse.success(res, "Media deleted.");
});

export const assignAttribs = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await ProductService.assignAttributes(req.params.id, req.body.attributes);
  return ApiResponse.success(res, "Attributes assigned.", result);
});

export const genVariants = asyncHandler(async (req: AuthRequest, res: Response) => {
  const variants = await ProductService.generateVariants(req.params.id);
  return ApiResponse.success(res, `${variants.length} variants generated.`, variants);
});

export const getVariants = asyncHandler(async (req: AuthRequest, res: Response) => {
  const product = await ProductService.getProduct(req.params.id);
  return ApiResponse.success(res, "Variants fetched.", product.variants);
});
