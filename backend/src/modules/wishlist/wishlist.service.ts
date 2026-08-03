import { prisma } from "../../config/database";
import { AppError } from "../../utils/apiResponse";

export async function getCustomerWishlist(customerId: string) {
  const items = await prisma.wishlist.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    include: {
      product: {
        select: {
          id: true,
          title: true,
          slug: true,
          shortDescription: true,
          media: {
            where: { type: "IMAGE" },
            orderBy: { sortOrder: "asc" },
            take: 1,
            select: { url: true },
          },
          category: {
            select: { name: true, slug: true },
          },
          prices: {
            take: 1,
            select: {
              sellingPrice: true,
              mrp: true,
              currency: { select: { symbol: true } },
            },
          },
          variants: {
            where: { status: "ACTIVE" },
            take: 1,
            select: {
              id: true,
              sku: true,
              prices: {
                take: 1,
                select: {
                  sellingPrice: true,
                  mrp: true,
                  currency: { select: { symbol: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  return items.map((item) => {
    const p = item.product;
    const image = p.media[0]?.url ?? null;
    const priceObj =
      p.prices[0] ??
      p.variants[0]?.prices[0] ??
      null;

    let priceFormatted = "";
    if (priceObj && priceObj.sellingPrice != null) {
      const val = Number(priceObj.sellingPrice);
      const symbol = (priceObj as any).currency?.symbol ?? "";
      priceFormatted = `${symbol}${val.toLocaleString("en-US", {
        maximumFractionDigits: 2,
      })}`;
    }

    return {
      id: item.id,
      productId: item.productId,
      createdAt: item.createdAt,
      product: {
        id: p.id,
        title: p.title,
        slug: p.slug,
        shortDescription: p.shortDescription,
        category: p.category.name,
        categorySlug: p.category.slug,
        image,
        price: priceFormatted,
        rawPrice: priceObj
          ? {
              sellingPrice: Number(priceObj.sellingPrice),
              mrp: priceObj.mrp != null ? Number(priceObj.mrp) : null,
              currencySymbol: (priceObj as any).currency?.symbol ?? "",
            }
          : null,
      },
    };
  });
}

export async function addToWishlist(customerId: string, productId: string) {
  if (!productId) {
    throw new AppError("Product ID is required.", 400);
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true },
  });

  if (!product) {
    throw new AppError("Product not found.", 404);
  }

  const existing = await prisma.wishlist.findUnique({
    where: {
      customerId_productId: { customerId, productId },
    },
  });

  if (existing) {
    return { wishlist: existing, isNew: false };
  }

  const wishlist = await prisma.wishlist.create({
    data: { customerId, productId },
  });

  return { wishlist, isNew: true };
}

export async function removeFromWishlist(customerId: string, productId: string) {
  if (!productId) {
    throw new AppError("Product ID is required.", 400);
  }

  await prisma.wishlist.deleteMany({
    where: { customerId, productId },
  });

  return { success: true };
}

export async function toggleWishlist(customerId: string, productId: string) {
  if (!productId) {
    throw new AppError("Product ID is required.", 400);
  }

  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true },
  });

  if (!product) {
    throw new AppError("Product not found.", 404);
  }

  const existing = await prisma.wishlist.findUnique({
    where: {
      customerId_productId: { customerId, productId },
    },
  });

  if (existing) {
    await prisma.wishlist.delete({
      where: { id: existing.id },
    });
    return { inWishlist: false };
  } else {
    await prisma.wishlist.create({
      data: { customerId, productId },
    });
    return { inWishlist: true };
  }
}

export async function getWishlistCount(customerId: string) {
  const count = await prisma.wishlist.count({
    where: { customerId },
  });
  return { count };
}

export async function syncGuestWishlist(customerId: string, productIds: string[]) {
  if (!productIds || productIds.length === 0) {
    return getCustomerWishlist(customerId);
  }

  // 1. Fetch valid product IDs to ensure we don't insert invalid references
  const validProducts = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true },
  });
  const validProductIds = validProducts.map((p) => p.id);

  if (validProductIds.length > 0) {
    // 2. Perform bulk creation (skipDuplicates is supported by PostgreSQL and MySQL)
    await prisma.wishlist.createMany({
      data: validProductIds.map((pid) => ({
        customerId,
        productId: pid,
      })),
      skipDuplicates: true,
    });
  }

  // 3. Return the fully merged list
  return getCustomerWishlist(customerId);
}
