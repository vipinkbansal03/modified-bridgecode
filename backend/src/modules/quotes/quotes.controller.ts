import { Response } from "express"; import { asyncHandler, ApiResponse } from "../../utils/apiResponse"; import { AuthRequest } from "../../middleware/auth.middleware"; import * as S from "./quotes.service"; import { generateQuotePdf } from "./quotePdf.service";
import { prisma } from "../../config/database";

export const create = asyncHandler(async (req: AuthRequest, res: Response) => {
  const quote = await S.createAdminQuote(req.body);
  await prisma.activityLog.create({
    data: {
      userId: req.user?.id,
      action: "QUOTE_CREATED",
      entityType: "Quote",
      entityId: quote.id,
      ipAddress: req.ip,
      metadata: { quoteNumber: quote.quoteNumber, total: quote.total },
    },
  }).catch(() => {});
  return ApiResponse.created(res, "Quote created.", quote);
});

export const list = asyncHandler(async (req: AuthRequest, res: Response) => { const r = await S.listQuotes(req.query as never); return ApiResponse.paginated(res, "Quotes.", r.data, { page: r.page, limit: r.limit, total: r.total }); });

export const getOne = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Quote.", await S.getQuote(String(req.params.id))));

export const updateStatus = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await S.updateStatus(String(req.params.id), req.body.status);
  await prisma.activityLog.create({
    data: {
      userId: req.user?.id,
      action: `QUOTE_STATUS_${req.body.status || "UPDATED"}`,
      entityType: "Quote",
      entityId: String(req.params.id),
      ipAddress: req.ip,
      metadata: { status: req.body.status },
    },
  }).catch(() => {});
  return ApiResponse.success(res, "Status updated.", result);
});

export const updateReview = asyncHandler(async (req: AuthRequest, res: Response) => {
  const quote = await S.updateQuoteReview(String(req.params.id), req.body);
  await prisma.activityLog.create({
    data: {
      userId: req.user?.id,
      action: "QUOTE_UPDATED",
      entityType: "Quote",
      entityId: String(req.params.id),
      ipAddress: req.ip,
    },
  }).catch(() => {});
  return ApiResponse.success(res, "Quote updated.", quote);
});

export const addNote = asyncHandler(async (req: AuthRequest, res: Response) => {
  const note = await S.addNote(String(req.params.id), req.user!.id, req.body.note);
  await prisma.activityLog.create({
    data: {
      userId: req.user?.id,
      action: "QUOTE_NOTE_ADDED",
      entityType: "Quote",
      entityId: String(req.params.id),
      ipAddress: req.ip,
    },
  }).catch(() => {});
  return ApiResponse.created(res, "Note added.", note);
});

export const convertToOrder = asyncHandler(async (req: AuthRequest, res: Response) => {
  const order = await S.convertToOrder(String(req.params.id));
  await prisma.activityLog.create({
    data: {
      userId: req.user?.id,
      action: "QUOTE_CONVERTED",
      entityType: "Quote",
      entityId: String(req.params.id),
      ipAddress: req.ip,
      metadata: { orderId: order.id, orderNumber: order.orderNumber },
    },
  }).catch(() => {});
  return ApiResponse.created(res, "Converted to order.", order);
});

export const softDelete = asyncHandler(async (req: AuthRequest, res: Response) => {
  await S.softDeleteQuote(String(req.params.id));
  await prisma.activityLog.create({
    data: {
      userId: req.user?.id,
      action: "QUOTE_ARCHIVED",
      entityType: "Quote",
      entityId: String(req.params.id),
      ipAddress: req.ip,
    },
  }).catch(() => {});
  return ApiResponse.success(res, "Quote archived successfully.");
});

export const restore = asyncHandler(async (req: AuthRequest, res: Response) => {
  await S.restoreQuote(String(req.params.id));
  await prisma.activityLog.create({
    data: {
      userId: req.user?.id,
      action: "QUOTE_RESTORED",
      entityType: "Quote",
      entityId: String(req.params.id),
      ipAddress: req.ip,
    },
  }).catch(() => {});
  return ApiResponse.success(res, "Quote restored successfully.");
});

export const permanentDelete = asyncHandler(async (req: AuthRequest, res: Response) => {
  await S.permanentDeleteQuote(String(req.params.id));
  await prisma.activityLog.create({
    data: {
      userId: req.user?.id,
      action: "QUOTE_DELETED",
      entityType: "Quote",
      entityId: String(req.params.id),
      ipAddress: req.ip,
    },
  }).catch(() => {});
  return ApiResponse.success(res, "Quote permanently deleted.");
});

export const bulkPermanentDelete = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const result = await S.bulkPermanentDeleteQuotes(ids);
  await prisma.activityLog.create({
    data: {
      userId: req.user?.id,
      action: "QUOTES_BULK_DELETED",
      entityType: "Quote",
      ipAddress: req.ip,
      metadata: { count: ids.length, ids },
    },
  }).catch(() => {});
  return ApiResponse.success(res, "Bulk permanent delete processed.", result);
});
export const deleteOne = softDelete;
export const downloadPdf = asyncHandler(async (req: AuthRequest, res: Response) => {
  const pdfBuffer = await generateQuotePdf(String(req.params.id));
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="quote-${req.params.id}.pdf"`);
  return res.send(pdfBuffer);
});
