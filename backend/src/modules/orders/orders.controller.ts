import { Response } from "express";
import { asyncHandler, ApiResponse, AppError } from "../../utils/apiResponse";
import { AuthRequest } from "../../middleware/auth.middleware";
import * as S from "./orders.service";
import {
  generateInvoice,
  getInvoiceData,
  saveInvoiceData,
  uploadCustomInvoice,
  generateSystemInvoice,
  deleteInvoice,
} from "./invoice.service";
import { prisma } from "../../config/database";

export const list = asyncHandler(async (req: AuthRequest, res: Response) => { const r = await S.listOrders(req.query as never); return ApiResponse.paginated(res, "Orders.", r.data, { page: r.page, limit: r.limit, total: r.total }); });

export const getCounts = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const counts = await S.getOrderCounts();
  return ApiResponse.success(res, "Order counts fetched.", counts);
});

export const create = asyncHandler(async (req: AuthRequest, res: Response) => {
  const order = await S.createAdminOrder(req.body);
  await prisma.activityLog.create({
    data: {
      userId: req.user?.id,
      action: "ORDER_CREATED",
      entityType: "Order",
      entityId: order.id,
      ipAddress: req.ip,
      metadata: { orderNumber: order.orderNumber, total: order.total },
    },
  }).catch(() => {});
  return ApiResponse.created(res, "Order created.", order);
});

export const getOne = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Order.", await S.getOrder(String(req.params.id))));

export const updateStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const updated = await S.updateStatus(String(req.params.id), req.body.status);
  await prisma.activityLog.create({
    data: {
      userId: req.user?.id,
      action: `ORDER_STATUS_${req.body.status || "UPDATED"}`,
      entityType: "Order",
      entityId: String(req.params.id),
      ipAddress: req.ip,
      metadata: { status: req.body.status },
    },
  }).catch(() => {});
  return ApiResponse.success(res, "Updated.", updated);
});

export const updatePayment = asyncHandler(async (req: AuthRequest, res: Response) => {
  const updated = await S.updatePaymentStatus(String(req.params.id), req.body.paymentStatus);
  await prisma.activityLog.create({
    data: {
      userId: req.user?.id,
      action: `ORDER_PAYMENT_${req.body.paymentStatus || "UPDATED"}`,
      entityType: "Order",
      entityId: String(req.params.id),
      ipAddress: req.ip,
      metadata: { paymentStatus: req.body.paymentStatus },
    },
  }).catch(() => {});
  return ApiResponse.success(res, "Updated.", updated);
});

export const updateShipping = asyncHandler(async (req: AuthRequest, res: Response) => {
  const updated = await S.updateShipping(String(req.params.id), req.body);
  await prisma.activityLog.create({
    data: {
      userId: req.user?.id,
      action: "ORDER_SHIPPING_UPDATED",
      entityType: "Order",
      entityId: String(req.params.id),
      ipAddress: req.ip,
      metadata: req.body,
    },
  }).catch(() => {});
  return ApiResponse.success(res, "Updated.", updated);
});

export const ship = asyncHandler(async (req: AuthRequest, res: Response) => {
  const order = await S.shipOrder(String(req.params.id), req.body);
  await prisma.activityLog.create({
    data: {
      userId: req.user?.id,
      action: "ORDER_SHIPPED",
      entityType: "Order",
      entityId: String(req.params.id),
      ipAddress: req.ip,
      metadata: req.body,
    },
  }).catch(() => {});
  return ApiResponse.success(res, "Order marked as shipped.", order);
});

export const deliver = asyncHandler(async (req: AuthRequest, res: Response) => {
  const order = await S.deliverOrder(String(req.params.id));
  await prisma.activityLog.create({
    data: {
      userId: req.user?.id,
      action: "ORDER_DELIVERED",
      entityType: "Order",
      entityId: String(req.params.id),
      ipAddress: req.ip,
    },
  }).catch(() => {});
  return ApiResponse.success(res, "Order marked as delivered.", order);
});

export const analytics = asyncHandler(async (_req: AuthRequest, res: Response) => ApiResponse.success(res, "Analytics.", await S.getAnalytics()));

export const getInvoice = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = String(req.params.id);
  const data = await getInvoiceData(id);
  return ApiResponse.success(res, "Invoice data retrieved.", data);
});

export const updateInvoice = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = String(req.params.id);
  const data = await saveInvoiceData(id, req.body);
  await prisma.activityLog.create({
    data: {
      userId: req.user?.id,
      action: "ORDER_INVOICE_UPDATED",
      entityType: "Order",
      entityId: id,
      ipAddress: req.ip,
      metadata: { invoiceNumber: data.invoiceNumber },
    },
  }).catch(() => {});
  return ApiResponse.success(res, "Invoice updated successfully.", data);
});

export const uploadInvoice = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = String(req.params.id);
  if (!req.file && !req.body.fileUrl) {
    throw new AppError("No invoice file uploaded or selected from media library.", 400);
  }
  const data = await uploadCustomInvoice(id, req.file, req.body);
  await prisma.activityLog.create({
    data: {
      userId: req.user?.id,
      action: "ORDER_INVOICE_UPLOADED",
      entityType: "Order",
      entityId: id,
      ipAddress: req.ip,
      metadata: { originalName: req.file?.originalname || req.body.fileName || req.body.fileUrl },
    },
  }).catch(() => {});
  return ApiResponse.success(res, "Custom invoice uploaded successfully.", data);
});

export const generateInvoiceHandler = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = String(req.params.id);
  const data = await generateSystemInvoice(id);
  await prisma.activityLog.create({
    data: {
      userId: req.user?.id,
      action: "ORDER_INVOICE_GENERATED",
      entityType: "Order",
      entityId: id,
      ipAddress: req.ip,
    },
  }).catch(() => {});
  return ApiResponse.success(res, "System invoice generated.", data);
});

export const removeInvoice = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = String(req.params.id);
  const data = await deleteInvoice(id);
  await prisma.activityLog.create({
    data: {
      userId: req.user?.id,
      action: "ORDER_INVOICE_REMOVED",
      entityType: "Order",
      entityId: id,
      ipAddress: req.ip,
    },
  }).catch(() => {});
  return ApiResponse.success(res, "Invoice removed.", data);
});

export const invoice = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = String(req.params.id);
  const { buffer, filename, contentType } = await generateInvoice(id);
  res.setHeader("Content-Type", contentType || "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(buffer);
});

export const refundCancelledOrder = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { refundMethod, transactionReference } = req.body;
  const result = await S.refundCancelledOrder(String(req.params.id), refundMethod, transactionReference);
  await prisma.activityLog.create({
    data: {
      userId: req.user?.id,
      action: "ORDER_REFUNDED",
      entityType: "Order",
      entityId: String(req.params.id),
      ipAddress: req.ip,
      metadata: { refundMethod, transactionReference },
    },
  }).catch(() => {});
  return ApiResponse.success(res, "Cancelled order refund processed successfully.", result);
});

export const softDelete = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await S.softDeleteOrder(String(req.params.id));
  await prisma.activityLog.create({
    data: {
      userId: req.user?.id,
      action: "ORDER_ARCHIVED",
      entityType: "Order",
      entityId: String(req.params.id),
      ipAddress: req.ip,
    },
  }).catch(() => {});
  return ApiResponse.success(res, "Order soft-deleted successfully.", result);
});

export const restore = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await S.restoreOrder(String(req.params.id));
  await prisma.activityLog.create({
    data: {
      userId: req.user?.id,
      action: "ORDER_RESTORED",
      entityType: "Order",
      entityId: String(req.params.id),
      ipAddress: req.ip,
    },
  }).catch(() => {});
  return ApiResponse.success(res, "Order restored successfully.", result);
});

export const permanentDelete = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await S.permanentDeleteOrder(String(req.params.id));
  await prisma.activityLog.create({
    data: {
      userId: req.user?.id,
      action: "ORDER_DELETED",
      entityType: "Order",
      entityId: String(req.params.id),
      ipAddress: req.ip,
    },
  }).catch(() => {});
  return ApiResponse.success(res, "Test order permanently deleted successfully.", result);
});

export const bulkPermanentDelete = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const result = await S.bulkPermanentDeleteOrders(ids);
  await prisma.activityLog.create({
    data: {
      userId: req.user?.id,
      action: "ORDERS_BULK_DELETED",
      entityType: "Order",
      ipAddress: req.ip,
      metadata: { count: ids.length, ids },
    },
  }).catch(() => {});
  return ApiResponse.success(res, "Bulk permanent delete processed.", result);
});
