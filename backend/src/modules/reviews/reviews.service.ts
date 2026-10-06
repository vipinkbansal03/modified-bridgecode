import { prisma } from "../../config/database";
import { AppError } from "../../utils/apiResponse";

export async function listReviews(params: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  ratingOverall?: number;
  productId?: string;
  categoryId?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortDir?: string;
  deleted?: string;
}) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const skip = (page - 1) * limit;

  const where: any = {};

  if (params.deleted === "true") {
    where.deletedAt = { not: null };
  } else {
    where.deletedAt = null;
  }

  if (params.status && params.status !== "ALL") {
    where.status = params.status;
  }

  if (params.ratingOverall && !isNaN(Number(params.ratingOverall))) {
    const r = Number(params.ratingOverall);
    if (r >= 1 && r <= 5) {
      where.ratingOverall = r;
    }
  }

  if (params.productId && params.productId.trim()) {
    where.productId = params.productId.trim();
  }

  if (params.categoryId && params.categoryId.trim()) {
    where.product = {
      ...(where.product || {}),
      categoryId: params.categoryId.trim(),
    };
  }

  if (params.dateFrom || params.dateTo) {
    where.createdAt = {};
    if (params.dateFrom) {
      const from = new Date(`${params.dateFrom}T00:00:00.000Z`);
      if (!isNaN(from.getTime())) {
        where.createdAt.gte = from;
      }
    }
    if (params.dateTo) {
      const to = new Date(`${params.dateTo}T23:59:59.999Z`);
      if (!isNaN(to.getTime())) {
        where.createdAt.lte = to;
      }
    }
  }

  if (params.search) {
    const s = params.search.trim();
    where.OR = [
      { customerName: { contains: s, mode: "insensitive" } },
      { customerEmail: { contains: s, mode: "insensitive" } },
      { feedbackText: { contains: s, mode: "insensitive" } },
      { product: { title: { contains: s, mode: "insensitive" } } },
    ];
  }

  const allowedSortFields = ["createdAt", "ratingOverall", "ratingQuality", "ratingPrice"];
  const sortField = allowedSortFields.includes(params.sortBy || "") ? (params.sortBy as string) : "createdAt";
  const sortDirection = params.sortDir?.toLowerCase() === "asc" ? "asc" : "desc";
  const orderBy: any = { [sortField]: sortDirection };

  const [reviews, total, totalCount, approvedCount, pendingCount, rejectedCount, avgAggregate] =
    await Promise.all([
      prisma.productReview.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          product: {
            select: {
              id: true,
              title: true,
              slug: true,
              media: {
                where: { type: "IMAGE" },
                orderBy: { sortOrder: "asc" },
                take: 1,
                select: { url: true },
              },
            },
          },
        },
      }),
      prisma.productReview.count({ where }),
      prisma.productReview.count({ where: { deletedAt: null } }),
      prisma.productReview.count({ where: { status: "APPROVED", deletedAt: null } }),
      prisma.productReview.count({ where: { status: "PENDING", deletedAt: null } }),
      prisma.productReview.count({ where: { status: "REJECTED", deletedAt: null } }),
      prisma.productReview.aggregate({
        where: { deletedAt: null },
        _avg: { ratingOverall: true },
      }),
    ]);

  const stats = {
    total: totalCount,
    approved: approvedCount,
    pending: pendingCount,
    rejected: rejectedCount,
    avgScore: avgAggregate._avg?.ratingOverall ? Number(avgAggregate._avg.ratingOverall.toFixed(1)) : 0,
  };

  return {
    reviews: reviews.map((r: any) => ({
      id: r.id,
      productId: r.productId,
      productTitle: r.product?.title || "Unknown Product",
      productSlug: r.product?.slug || "",
      productImage: r.product?.media?.[0]?.url || null,
      customerName: r.customerName,
      customerEmail: r.customerEmail,
      ratingQuality: r.ratingQuality,
      ratingPrice: r.ratingPrice,
      ratingOverall: r.ratingOverall,
      feedbackText: r.feedbackText,
      status: r.status,
      deletedAt: r.deletedAt,
      createdAt: r.createdAt,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    stats,
  };
}

export async function updateReviewStatus(id: string, status: string) {
  const review = await prisma.productReview.update({
    where: { id },
    data: { status },
  });
  return review;
}

export async function softDeleteReview(id: string) {
  const existing = await prisma.productReview.findUnique({ where: { id } });
  if (!existing) throw new AppError("Review not found", 404);
  if (existing.deletedAt) throw new AppError("Review is already archived.", 400);

  return prisma.productReview.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

export const deleteReview = softDeleteReview;

export async function restoreReview(id: string) {
  const existing = await prisma.productReview.findUnique({ where: { id } });
  if (!existing) throw new AppError("Review not found", 404);
  if (!existing.deletedAt) throw new AppError("Review is already active.", 400);

  return prisma.productReview.update({
    where: { id },
    data: { deletedAt: null },
  });
}

export async function permanentDeleteReview(id: string) {
  const review = await prisma.productReview.findUnique({
    where: { id },
    include: { product: { select: { title: true } } },
  });

  if (!review) throw new AppError("Review not found", 404);

  if (review.status === "APPROVED") {
    throw new AppError(
      "Cannot permanently delete an approved review. Approved customer reviews must be retained for integrity.",
      400
    );
  }

  await prisma.productReview.delete({ where: { id } });
  return { success: true };
}

export async function bulkPermanentDeleteReviews(ids: string[]) {
  const deletedIds: string[] = [];
  const blocked: Array<{ id: string; name: string; reason: string }> = [];

  const uniqueIds = Array.from(new Set(ids ?? []));
  if (uniqueIds.length === 0) {
    return {
      deletedCount: 0,
      blockedCount: 0,
      deletedIds: [],
      blocked: [],
    };
  }

  // 1. Fetch requested reviews in safe batch chunks
  const reviews: Array<{ id: string; customerName: string | null; status: string; product: { title: string } | null }> = [];
  const FETCH_CHUNK = 1000;
  for (let i = 0; i < uniqueIds.length; i += FETCH_CHUNK) {
    const chunk = uniqueIds.slice(i, i + FETCH_CHUNK);
    const rows = await prisma.productReview.findMany({
      where: { id: { in: chunk } },
      select: {
        id: true,
        customerName: true,
        status: true,
        product: { select: { title: true } },
      },
    });
    reviews.push(...rows);
  }

  const reviewMap = new Map(reviews.map((r) => [r.id, r]));
  const eligibleIds: string[] = [];

  for (const id of uniqueIds) {
    const review = reviewMap.get(id);
    if (!review) {
      blocked.push({ id, name: id, reason: "Review not found." });
      continue;
    }
    if (review.status === "APPROVED") {
      blocked.push({
        id,
        name: review.customerName || review.product?.title || id,
        reason: "Cannot permanently delete an approved review. Approved customer reviews must be retained.",
      });
      continue;
    }
    eligibleIds.push(id);
  }

  // 2. Batch delete eligible reviews in chunks of 100 with fallback
  const CHUNK_SIZE = 100;
  for (let i = 0; i < eligibleIds.length; i += CHUNK_SIZE) {
    const chunk = eligibleIds.slice(i, i + CHUNK_SIZE);
    try {
      await prisma.productReview.deleteMany({ where: { id: { in: chunk } } });
      deletedIds.push(...chunk);
    } catch {
      for (const singleId of chunk) {
        try {
          await prisma.productReview.delete({ where: { id: singleId } });
          deletedIds.push(singleId);
        } catch (singleErr: any) {
          const rev = reviewMap.get(singleId);
          blocked.push({
            id: singleId,
            name: rev?.customerName || rev?.product?.title || singleId,
            reason: singleErr?.message || "Failed to permanently delete review.",
          });
        }
      }
    }
  }

  return {
    deletedCount: deletedIds.length,
    blockedCount: blocked.length,
    deletedIds,
    blocked,
  };
}

export async function bulkRestoreReviews(ids: string[]) {
  const result = await prisma.productReview.updateMany({
    where: { id: { in: ids }, deletedAt: { not: null } },
    data: { deletedAt: null },
  });
  return { restoredCount: result.count };
}
