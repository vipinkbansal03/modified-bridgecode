import { Response } from "express";
import { asyncHandler, ApiResponse, AppError } from "../../utils/apiResponse";
import { CustomerAuthRequest } from "../../middleware/customerAuth.middleware";
import { AuthRequest } from "../../middleware/auth.middleware";
import * as S from "./orderReturns.service";
import { uploadFile } from "../../config/storage";

// Customer Endpoints
export const createReturn = asyncHandler(async (req: CustomerAuthRequest, res: Response) => {
  if (!req.customer) throw new AppError("Customer authentication required.", 401);
  const { orderId, reason, notes, refundDetails, items } = req.body;
  if (!orderId || !reason || !items) {
    throw new AppError("orderId, reason, and items are required.", 400);
  }

  let parsedItems = items;
  if (typeof items === "string") {
    try {
      parsedItems = JSON.parse(items);
    } catch {
      throw new AppError("Invalid items format.", 400);
    }
  }

  if (!Array.isArray(parsedItems)) {
    throw new AppError("items must be an array.", 400);
  }

  const attachmentUrls: string[] = [];
  const files = req.files as Express.Multer.File[] | undefined;
  if (files && files.length > 0) {
    for (const file of files) {
      const uploadResult = await uploadFile(file.path, "returns");
      attachmentUrls.push(uploadResult.url);
    }
  }

  const result = await S.createReturnRequest(req.customer.id, orderId, {
    reason,
    notes,
    refundDetails,
    attachmentUrls,
    items: parsedItems,
  });

  return ApiResponse.created(res, "Return request created successfully.", result);
});

export const listCustomerReturns = asyncHandler(async (req: CustomerAuthRequest, res: Response) => {
  if (!req.customer) throw new AppError("Customer authentication required.", 401);
  const result = await S.listCustomerReturns(req.customer.id);
  return ApiResponse.success(res, "Customer returns.", result);
});

// Admin Endpoints
export const listAllReturns = asyncHandler(async (req: AuthRequest, res: Response) => {
  const r = await S.listAllReturns(req.query as never);
  return ApiResponse.paginated(res, "All return requests.", r.data, {
    page: r.meta.page,
    limit: r.meta.limit,
    total: r.meta.total,
  });
});

export const getReturnDetails = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await S.getReturnDetails(String(req.params.id));
  return ApiResponse.success(res, "Return request details.", result);
});

export const updateReturnStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { status, adminNotes, refundMethod, transactionReference } = req.body;
  if (!status || !["APPROVED", "REJECTED", "COMPLETED"].includes(status)) {
    throw new AppError("Valid status (APPROVED, REJECTED, COMPLETED) is required.", 400);
  }

  const result = await S.updateReturnStatus(
    String(req.params.id),
    status,
    adminNotes,
    refundMethod,
    transactionReference
  );
  return ApiResponse.success(res, "Return request status updated.", result);
});

export const cancelReturn = asyncHandler(async (req: CustomerAuthRequest, res: Response) => {
  if (!req.customer) throw new AppError("Customer authentication required.", 401);
  const result = await S.cancelReturnRequest(req.customer.id, String(req.params.id));
  return ApiResponse.success(res, "Return request cancelled.", result);
});
