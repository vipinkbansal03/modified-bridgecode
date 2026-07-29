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
