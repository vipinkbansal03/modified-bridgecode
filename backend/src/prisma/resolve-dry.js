const { resolvePrice } = require("../../dist/modules/pricing/priceResolver.service");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const product = await prisma.product.findFirst({
    where: { slug: "elfin-bondable-molar-tube" }
  });
  if (!product) {
    console.error("Product not found");
    return;
  }
  const variant = await prisma.productVariant.findFirst({
    where: { productId: product.id }
  });
  const country = await prisma.country.findFirst({
    where: { code: "IN" }
  });

  if (!variant || !country) {
    console.error("Variant or country not found");
    return;
  }

  console.log("Product ID:", product.id);
  console.log("Variant ID:", variant.id);
  console.log("Country ID:", country.id);

  const resolved = await resolvePrice({
    productId: product.id,
    variantId: variant.id,
    countryId: country.id,
    quantity: 1
  });
  console.log("\n=== Resolved Price Result ===");
  console.log(JSON.stringify(resolved, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
