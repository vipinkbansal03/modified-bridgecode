import { prisma } from "../../config/database";
import { AppError } from "../../utils/apiResponse";

export async function assertActiveCountry(countryId: string) {
  const country = await prisma.country.findUnique({
    where: { id: countryId },
    include: { currency: true },
  });

  if (!country) throw new AppError("Country not found.", 404);
  if (country.status !== "ACTIVE") throw new AppError("Selected country is inactive.", 400);
  return country;
}

export async function assertSellableInCountry(input: {
  countryId: string;
  productId: string;
  variantId?: string | null;
}) {
  const product = await prisma.product.findFirst({
    where: {
      id: input.productId,
      status: "ACTIVE",
      deletedAt: null,
      OR: [
        { countries: { some: { countryId: input.countryId, enabled: true } } },
        { countries: { none: {} } },
      ],
      category: {
        status: "ACTIVE",
        deletedAt: null,
        OR: [
          { countries: { some: { countryId: input.countryId, enabled: true } } },
          { countries: { none: {} } },
        ],
      },
      ...(input.variantId
        ? {
            variants: {
              some: {
                id: input.variantId,
                status: "ACTIVE",
                OR: [
                  { countries: { some: { countryId: input.countryId, enabled: true } } },
                  { countries: { none: {} } },
                ],
              },
            },
          }
        : {}),
    },
    select: { id: true },
  });

  if (!product) {
    throw new AppError(
      input.variantId
        ? "The selected variant is not available in the chosen country."
        : "The selected product is not available in the chosen country.",
      400,
    );
  }

  return product;
}

export async function assertSellableInCountryBatch(input: {
  countryId: string;
  items: Array<{ productId: string; variantId?: string | null }>;
}) {
  if (!input.items.length) return;

  const productIds = Array.from(new Set(input.items.map((i) => i.productId)));
  const variantIds = Array.from(
    new Set(input.items.map((i) => i.variantId).filter(Boolean)),
  ) as string[];

  const sellableProducts = await prisma.product.findMany({
    where: {
      id: { in: productIds },
      status: "ACTIVE",
      deletedAt: null,
      OR: [
        { countries: { some: { countryId: input.countryId, enabled: true } } },
        { countries: { none: {} } },
      ],
      category: {
        status: "ACTIVE",
        deletedAt: null,
        OR: [
          { countries: { some: { countryId: input.countryId, enabled: true } } },
          { countries: { none: {} } },
        ],
      },
    },
    select: { id: true },
  });

  const sellableProductIds = new Set(sellableProducts.map((p) => p.id));
  for (const item of input.items) {
    if (!sellableProductIds.has(item.productId)) {
      throw new AppError(
        "The selected product is not available in the chosen country.",
        400,
      );
    }
  }

  if (variantIds.length > 0) {
    const sellableVariants = await prisma.productVariant.findMany({
      where: {
        id: { in: variantIds },
        status: "ACTIVE",
        OR: [
          { countries: { some: { countryId: input.countryId, enabled: true } } },
          { countries: { none: {} } },
        ],
      },
      select: { id: true },
    });

    const sellableVariantIds = new Set(sellableVariants.map((v) => v.id));
    for (const item of input.items) {
      if (item.variantId && !sellableVariantIds.has(item.variantId)) {
        throw new AppError(
          "The selected variant is not available in the chosen country.",
          400,
        );
      }
    }
  }
}
