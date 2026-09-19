import { prisma } from "../config/database";

async function main() {
  const [countries, products, categories, variants] = await Promise.all([
    prisma.country.findMany({ where: { status: "ACTIVE" }, select: { id: true, code: true } }),
    prisma.product.findMany({ where: { status: "ACTIVE", deletedAt: null }, select: { id: true, slug: true } }),
    prisma.category.findMany({ where: { status: "ACTIVE", deletedAt: null }, select: { id: true, slug: true } }),
    prisma.productVariant.findMany({ where: { status: "ACTIVE", product: { status: "ACTIVE", deletedAt: null } }, select: { id: true, sku: true } }),
  ]);

  const productCountryRows: Array<{ productId: string; countryId: string; enabled: boolean }> = [];
  for (const product of products) {
    for (const country of countries) {
      productCountryRows.push({ productId: product.id, countryId: country.id, enabled: true });
    }
  }

  const categoryCountryRows: Array<{ categoryId: string; countryId: string; enabled: boolean }> = [];
  for (const category of categories) {
    for (const country of countries) {
      categoryCountryRows.push({ categoryId: category.id, countryId: country.id, enabled: true });
    }
  }

  const variantCountryRows: Array<{ variantId: string; countryId: string; enabled: boolean }> = [];
  for (const variant of variants) {
    for (const country of countries) {
      variantCountryRows.push({ variantId: variant.id, countryId: country.id, enabled: true });
    }
  }

  await prisma.$transaction(async (tx) => {
    for (let i = 0; i < productCountryRows.length; i += 1000) {
      await tx.productCountry.createMany({
        data: productCountryRows.slice(i, i + 1000),
        skipDuplicates: true,
      });
    }

    for (let i = 0; i < categoryCountryRows.length; i += 1000) {
      await tx.categoryCountry.createMany({
        data: categoryCountryRows.slice(i, i + 1000),
        skipDuplicates: true,
      });
    }

    for (let i = 0; i < variantCountryRows.length; i += 1000) {
      await tx.variantCountry.createMany({
        data: variantCountryRows.slice(i, i + 1000),
        skipDuplicates: true,
      });
    }
  });

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
