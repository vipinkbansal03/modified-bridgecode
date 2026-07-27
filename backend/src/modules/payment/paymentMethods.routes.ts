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

const router = Router();

// Storefront Public Route: Fetch available payment methods by country
router.get("/public/payment-methods", asyncHandler(getPublicPaymentMethodsController));

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

// Admin Routes: Payment Matrix management
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

export default router;
