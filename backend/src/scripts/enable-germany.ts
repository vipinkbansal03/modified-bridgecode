import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const product = await prisma.product.findFirst({
    where: { slug: "elfin-bondable-molar-tube" }
  });
  if (!product) {
    console.log("Product not found");
    return;
  }

  const germany = await prisma.country.findUnique({
    where: { code: "DE" }
  });
  if (!germany) {
    console.log("Germany not found");
    return;
  }

  // 1. Enable product for Germany
  await prisma.productCountry.upsert({
    where: { productId_countryId: { productId: product.id, countryId: germany.id } },
    update: { enabled: true },
    create: { productId: product.id, countryId: germany.id, enabled: true }
  });
  console.log("Product enabled for Germany.");

  // 2. Disable variant for Germany
  const variant = await prisma.productVariant.findUnique({
    where: { sku: "ELFIN-L-Roth-022-H4-019025" }
  });
  if (!variant) {
    console.log("Variant not found");
    return;
  }

  await prisma.variantCountry.upsert({
    where: { variantId_countryId: { variantId: variant.id, countryId: germany.id } },
    update: { enabled: false },
    create: { variantId: variant.id, countryId: germany.id, enabled: false }
  });
  console.log("Variant disabled for Germany.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
