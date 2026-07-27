import { Response } from "express";
import { asyncHandler, ApiResponse, AppError } from "../../utils/apiResponse";
import { CustomerAuthRequest } from "../../middleware/customerAuth.middleware";
import * as CustomerQuotesService from "./customerQuotes.service";

export const list = asyncHandler(async (req: CustomerAuthRequest, res: Response) => {
  if (!req.customer) {
    throw new AppError("Customer authentication required.", 401);
  }

  const quotes = await CustomerQuotesService.listCustomerQuotes(req.customer.id);

  return ApiResponse.success(res, "Quotes.", quotes);
});

export const getOne = asyncHandler(async (req: CustomerAuthRequest, res: Response) => {
  if (!req.customer) {
    throw new AppError("Customer authentication required.", 401);
  }

  const quote = await CustomerQuotesService.getCustomerQuote(
    req.customer.id,
    String(req.params.id)
  );

  return ApiResponse.success(res, "Quote.", quote);
});

export const accept = asyncHandler(async (req: CustomerAuthRequest, res: Response) => {
  if (!req.customer) {
    throw new AppError("Customer authentication required.", 401);
  }

  const quote = await CustomerQuotesService.acceptCustomerQuote(req.customer.id, String(req.params.id));
  return ApiResponse.success(res, "Quote accepted.", quote);
});

export const decline = asyncHandler(async (req: CustomerAuthRequest, res: Response) => {
  if (!req.customer) {
    throw new AppError("Customer authentication required.", 401);
  }

  const quote = await CustomerQuotesService.declineCustomerQuote(req.customer.id, String(req.params.id));
  return ApiResponse.success(res, "Quote declined.", quote);
});