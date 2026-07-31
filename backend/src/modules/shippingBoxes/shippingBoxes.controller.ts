import { Response } from "express";
import { asyncHandler, ApiResponse } from "../../utils/apiResponse";
import { AuthRequest } from "../../middleware/auth.middleware";
import * as ShippingBoxService from "./shippingBoxes.service";

export const list = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const boxes = await ShippingBoxService.listBoxes();
  return ApiResponse.success(res, "Shipping boxes fetched.", boxes);
});

export const getOne = asyncHandler(async (req: AuthRequest, res: Response) => {
  const box = await ShippingBoxService.getBox(req.params.id);
  return ApiResponse.success(res, "Shipping box fetched.", box);
});

export const create = asyncHandler(async (req: AuthRequest, res: Response) => {
  const box = await ShippingBoxService.createBox(req.body);
  return ApiResponse.created(res, "Shipping box created.", box);
});

export const update = asyncHandler(async (req: AuthRequest, res: Response) => {
  const box = await ShippingBoxService.updateBox(req.params.id, req.body);
  return ApiResponse.success(res, "Shipping box updated.", box);
});

export const remove = asyncHandler(async (req: AuthRequest, res: Response) => {
  await ShippingBoxService.deleteBox(req.params.id);
  return ApiResponse.success(res, "Shipping box deleted.");
});

export const toggle = asyncHandler(async (req: AuthRequest, res: Response) => {
  const box = await ShippingBoxService.toggleBox(req.params.id);
  return ApiResponse.success(res, "Shipping box toggled.", box);
});
