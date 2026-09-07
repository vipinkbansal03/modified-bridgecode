import { Request, Response } from "express";
import { asyncHandler, ApiResponse } from "../../utils/apiResponse";
import * as S from "./reviews.service";

export const list = asyncHandler(async (req: Request, res: Response) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 20;
  const search = req.query.search ? String(req.query.search) : undefined;
  const status = req.query.status ? String(req.query.status) : undefined;
  const ratingOverall = req.query.ratingOverall ? Number(req.query.ratingOverall) : undefined;
  const productId = req.query.productId ? String(req.query.productId) : undefined;
  const categoryId = req.query.categoryId ? String(req.query.categoryId) : undefined;
  const dateFrom = req.query.dateFrom ? String(req.query.dateFrom) : undefined;
  const dateTo = req.query.dateTo ? String(req.query.dateTo) : undefined;
  const sortBy = req.query.sortBy ? String(req.query.sortBy) : undefined;
  const sortDir = req.query.sortDir ? String(req.query.sortDir) : undefined;
  const deleted = req.query.deleted ? String(req.query.deleted) : undefined;

  const result = await S.listReviews({
    page,
    limit,
    search,
    status,
    ratingOverall,
    productId,
    categoryId,
    dateFrom,
    dateTo,
    sortBy,
    sortDir,
    deleted,
  });
  res.json({
    success: true,
    data: result.reviews,
    pagination: result.pagination,
    stats: result.stats,
  });
});

export const updateStatus = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const { status } = req.body;
  const review = await S.updateReviewStatus(id, String(status));
  res.json({ success: true, message: "Review status updated", data: review });
});

export const softDelete = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  await S.softDeleteReview(id);
  res.json({ success: true, message: "Review archived successfully" });
});

export const remove = softDelete;

export const restore = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  const data = await S.restoreReview(id);
  res.json({ success: true, message: "Review restored successfully", data });
});

export const permanentDelete = asyncHandler(async (req: Request, res: Response) => {
  const id = String(req.params.id);
  await S.permanentDeleteReview(id);
  res.json({ success: true, message: "Review permanently deleted successfully" });
});

export const bulkPermanentDelete = asyncHandler(async (req: Request, res: Response) => {
  const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const result = await S.bulkPermanentDeleteReviews(ids);
  res.json({ success: true, message: "Bulk permanent delete processed.", data: result });
});

export const bulkRestore = asyncHandler(async (req: Request, res: Response) => {
  const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const result = await S.bulkRestoreReviews(ids);
  res.json({ success: true, message: "Bulk restore processed.", data: result });
});
