import { prisma } from "../../config/database";

export async function listReviews(params: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const skip = (page - 1) * limit;

  const where: any = {};

  if (params.status && params.status !== "ALL") {
    where.status = params.status;
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

  const [reviews, total] = await Promise.all([
    prisma.productReview.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        product: {
          select: { id: true, title: true, slug: true },
        },
      },
    }),
    prisma.productReview.count({ where }),
  ]);

  return {
    reviews: reviews.map((r: any) => ({
      id: r.id,
      productId: r.productId,
      productTitle: r.product?.title || "Unknown Product",
      productSlug: r.product?.slug || "",
      productImage: null,
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
