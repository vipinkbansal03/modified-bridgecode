import { prisma } from "../config/database";

async function main() {
  const [countries, products, categories, variants] = await Promise.all([
    prisma.country.findMany({ where: { status: "ACTIVE" }, select: { id: true, code: true } }),
    prisma.product.findMany({ where: { status: "ACTIVE", deletedAt: null }, select: { id: true, slug: true } }),
    prisma.category.findMany({ where: { status: "ACTIVE", deletedAt: null }, select: { id: true, slug: true } }),
    prisma.productVariant.findMany({ where: { status: "ACTIVE", product: { status: "ACTIVE", deletedAt: null } }, select: { id: true, sku: true } }),
  ]);

  for (const product of products) {
    for (const country of countries) {
      await prisma.productCountry.upsert({
        where: { productId_countryId: { productId: product.id, countryId: country.id } },
        update: { enabled: true },
        create: { productId: product.id, countryId: country.id, enabled: true },
      });
    }
  }

  for (const category of categories) {
    for (const country of countries) {
      await prisma.categoryCountry.upsert({
        where: { categoryId_countryId: { categoryId: category.id, countryId: country.id } },
        update: { enabled: true },
        create: { categoryId: category.id, countryId: country.id, enabled: true },
      });
    }
  }

  for (const variant of variants) {
    for (const country of countries) {
      await prisma.variantCountry.upsert({
        where: { variantId_countryId: { variantId: variant.id, countryId: country.id } },
        update: { enabled: true },
        create: { variantId: variant.id, countryId: country.id, enabled: true },
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        countries: countries.length,
        productsEnabled: products.length,
        categoriesEnabled: categories.length,
        variantsEnabled: variants.length,
        productCountryRowsTarget: countries.length * products.length,
        categoryCountryRowsTarget: countries.length * categories.length,
        variantCountryRowsTarget: countries.length * variants.length,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
