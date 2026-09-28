import "../config/env";
import { prisma } from "../config/database";

async function main() {
  const p = await prisma.product.findFirst({
    where: { slug: "sapphire-true-twin" },
    select: { id: true, title: true },
  });
  if (!p) {
    console.log("Product not found");
    return;
  }
  console.log(`Cleaning variants for ${p.title} (${p.id})...`);

  const variants = await prisma.productVariant.findMany({
    where: { productId: p.id },
    select: { id: true },
  });
  const variantIds = variants.map((v) => v.id);
  console.log(`Found ${variantIds.length} variants to delete.`);

  if (variantIds.length > 0) {
    for (let i = 0; i < variantIds.length; i += 1000) {
      const chunk = variantIds.slice(i, i + 1000);
      await prisma.productVariantAttributeValue.deleteMany({ where: { variantId: { in: chunk } } });
      await prisma.productPrice.deleteMany({ where: { variantId: { in: chunk } } });
      await prisma.inventory.deleteMany({ where: { variantId: { in: chunk } } });
      await prisma.variantCountry.deleteMany({ where: { variantId: { in: chunk } } });
      await prisma.variantPaymentMethod.deleteMany({ where: { variantId: { in: chunk } } });
    }
    await prisma.productVariant.deleteMany({ where: { productId: p.id } });
    console.log("Deleted all variants successfully!");
  } else {
    console.log("No variants found to delete.");
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
