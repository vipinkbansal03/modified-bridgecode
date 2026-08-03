import { Response } from "express";
import { asyncHandler, ApiResponse, AppError } from "../../utils/apiResponse";
import { CustomerAuthRequest } from "../../middleware/customerAuth.middleware";
import * as WishlistService from "./wishlist.service";

export const list = asyncHandler(async (req: CustomerAuthRequest, res: Response) => {
  if (!req.customer) throw new AppError("Customer authentication required.", 401);
  const items = await WishlistService.getCustomerWishlist(req.customer.id);
  return ApiResponse.success(res, "Wishlist items.", items);
});

export const add = asyncHandler(async (req: CustomerAuthRequest, res: Response) => {
  if (!req.customer) throw new AppError("Customer authentication required.", 401);
  const { productId } = req.body;
  const result = await WishlistService.addToWishlist(req.customer.id, productId);
  return ApiResponse.success(
    res,
    result.isNew ? "Added to wishlist." : "Product already in wishlist.",
    result.wishlist
  );
});

export const remove = asyncHandler(async (req: CustomerAuthRequest, res: Response) => {
  if (!req.customer) throw new AppError("Customer authentication required.", 401);
  const productId = req.params.productId;
  const result = await WishlistService.removeFromWishlist(req.customer.id, productId);
  return ApiResponse.success(res, "Removed from wishlist.", result);
});

export const toggle = asyncHandler(async (req: CustomerAuthRequest, res: Response) => {
  if (!req.customer) throw new AppError("Customer authentication required.", 401);
  const { productId } = req.body;
  const result = await WishlistService.toggleWishlist(req.customer.id, productId);
  return ApiResponse.success(
    res,
    result.inWishlist ? "Added to wishlist." : "Removed from wishlist.",
    result
  );
});

export const count = asyncHandler(async (req: CustomerAuthRequest, res: Response) => {
  if (!req.customer) throw new AppError("Customer authentication required.", 401);
  const result = await WishlistService.getWishlistCount(req.customer.id);
  return ApiResponse.success(res, "Wishlist count.", result);
});

export const sync = asyncHandler(async (req: CustomerAuthRequest, res: Response) => {
  if (!req.customer) throw new AppError("Customer authentication required.", 401);
  const productIds = Array.isArray(req.body?.productIds) ? req.body.productIds : [];
  const mergedWishlist = await WishlistService.syncGuestWishlist(req.customer.id, productIds);
  return ApiResponse.success(res, "Wishlist synced successfully.", mergedWishlist);
});
