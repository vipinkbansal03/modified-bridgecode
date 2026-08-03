import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { ApiResponse } from "../../utils/apiResponse";
import {
  getProductAndVariantOverrides,
  updateProductAndVariantOverrides,
  resolveCartPaymentMethods,
} from "./paymentOverrides.service";

export async function getProductAndVariantOverridesController(
  req: AuthRequest,
  res: Response
) {
  const productId = req.params.id as string;
  const result = await getProductAndVariantOverrides(productId);
  return ApiResponse.success(
    res,
    "Product and variant payment overrides fetched successfully.",
    result
  );
}

export async function updateProductAndVariantOverridesController(
  req: AuthRequest,
  res: Response
) {
  const productId = req.params.id as string;
  const userId = req.user!.id;
  const { productOverrides, variantOverrides } = req.body;

  const result = await updateProductAndVariantOverrides(productId, userId, {
    productOverrides: productOverrides || [],
    variantOverrides: variantOverrides || [],
  });

  return ApiResponse.success(
    res,
    "Product and variant payment overrides updated successfully.",
    result
  );
}

export async function resolvePublicPaymentMethodsController(
  req: AuthRequest,
  res: Response
) {
  const { countryCode, cartItems } = req.body;
  const result = await resolveCartPaymentMethods(
    countryCode || "IN",
    cartItems || []
  );

  return ApiResponse.success(
    res,
    "Available payment methods resolved successfully.",
    result
  );
}
