import { Router } from "express";
import { asyncHandler } from "../../utils/apiResponse";
import { protectCustomer } from "../../middleware/customerAuth.middleware";
import { protect } from "../../middleware/auth.middleware";
import {
  getAdminPaymentMatrixController,
  getPublicPaymentMethodsController,
  initiateCustomerOrderPaymentController,
  updateAdminPaymentMethodCountryController,
  verifyCustomerOrderPaymentController,
} from "./paymentMethods.controller";

import {
  getProductAndVariantOverridesController,
  updateProductAndVariantOverridesController,
  resolvePublicPaymentMethodsController,
} from "./paymentOverrides.controller";

const router = Router();

// Storefront Public Routes: Fetch and Resolve available payment methods
router.get("/public/payment-methods", asyncHandler(getPublicPaymentMethodsController));
router.post("/public/payment-methods/resolve", asyncHandler(resolvePublicPaymentMethodsController));

// Customer Routes: Initiate and Verify payment
router.post(
  "/customer/orders/:id/payment/initiate",
  protectCustomer,
  asyncHandler(initiateCustomerOrderPaymentController),
);
router.post(
  "/customer/orders/:id/payment/verify",
  protectCustomer,
  asyncHandler(verifyCustomerOrderPaymentController),
);

// Admin Routes: Payment Matrix and Overrides management
router.get(
  "/admin/payment-methods/matrix",
  protect,
  asyncHandler(getAdminPaymentMatrixController),
);
router.put(
  "/admin/payment-methods/country",
  protect,
  asyncHandler(updateAdminPaymentMethodCountryController),
);
router.get(
  "/admin/products/:id/payment-overrides",
  protect,
  asyncHandler(getProductAndVariantOverridesController),
);
router.put(
  "/admin/products/:id/payment-overrides",
  protect,
  asyncHandler(updateProductAndVariantOverridesController),
);

export default router;
