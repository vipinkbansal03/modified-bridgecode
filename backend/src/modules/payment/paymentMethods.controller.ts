import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.middleware";
import { CustomerAuthRequest } from "../../middleware/customerAuth.middleware";
import { ApiResponse } from "../../utils/apiResponse";
import {
  getAdminPaymentMatrix,
  getAvailablePaymentMethodsForCountry,
  initiatePaymentForOrder,
  updateAdminPaymentMethodCountry,
  updateAdminPaymentMethodGlobal,
  verifyPaymentForOrder,
} from "./paymentMethods.service";

export async function getPublicPaymentMethodsController(req: AuthRequest, res: Response) {
  const countryCode = (req.query.countryCode as string) || "IN";
  const methods = await getAvailablePaymentMethodsForCountry(countryCode);
  return ApiResponse.success(res, "Available payment methods fetched successfully.", methods);
}

export async function getAdminPaymentMatrixController(req: AuthRequest, res: Response) {
  const matrix = await getAdminPaymentMatrix();
  return ApiResponse.success(res, "Payment matrix fetched successfully.", matrix);
}

export async function updateAdminPaymentMethodCountryController(req: AuthRequest, res: Response) {
  const { paymentMethodId, countryId, isEnabled } = req.body;
  const updated = await updateAdminPaymentMethodCountry(
    paymentMethodId,
    countryId,
    Boolean(isEnabled),
  );
  return ApiResponse.success(res, "Payment method country settings updated.", updated);
}

export async function updateAdminPaymentMethodGlobalController(req: AuthRequest, res: Response) {
  const { paymentMethodId, isEnabled, applyToAllCountries } = req.body;
  const updated = await updateAdminPaymentMethodGlobal(
    paymentMethodId,
    Boolean(isEnabled),
    applyToAllCountries !== undefined ? Boolean(applyToAllCountries) : true,
  );
  return ApiResponse.success(res, "Global payment method settings updated.", updated);
}

export async function initiateCustomerOrderPaymentController(req: CustomerAuthRequest, res: Response) {
  const customerId = req.customer!.id;
  const orderId = req.params.id as string;
  const { paymentMethodCode } = req.body;

  const result = await initiatePaymentForOrder(customerId, orderId, paymentMethodCode || "COD");
  return ApiResponse.success(res, "Payment initiated successfully.", result);
}

export async function verifyCustomerOrderPaymentController(req: CustomerAuthRequest, res: Response) {
  const customerId = req.customer!.id;
  const orderId = req.params.id as string;
  const { paymentMethodCode, payload } = req.body;

  const result = await verifyPaymentForOrder(
    customerId,
    orderId,
    paymentMethodCode || "RAZORPAY",
    payload || req.body,
  );
  return ApiResponse.success(res, "Payment verified successfully.", result);
}
