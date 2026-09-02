import { prisma } from "../../config/database";

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
}) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const skip = (page - 1) * limit;

  const where: any = {};

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
      prisma.productReview.count(),
      prisma.productReview.count({ where: { status: "APPROVED" } }),
      prisma.productReview.count({ where: { status: "PENDING" } }),
      prisma.productReview.count({ where: { status: "REJECTED" } }),
      prisma.productReview.aggregate({
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

export async function deleteReview(id: string) {
  await prisma.productReview.delete({
    where: { id },
  });
  return { success: true };
}
