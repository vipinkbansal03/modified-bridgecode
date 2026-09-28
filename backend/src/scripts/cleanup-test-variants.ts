import "../config/env";
import { prisma } from "../config/database";

async function main() {
  console.log("Searching for product: sapphire-true-twin...");
  const product = await prisma.product.findFirst({
    where: { slug: "sapphire-true-twin" },
    select: { id: true, title: true, _count: { select: { variants: true } } },
  });

  if (!product) {
    console.log("Product sapphire-true-twin not found. Checking all products with > 500 variants...");
    const heavyProducts = await prisma.product.findMany({
      select: { id: true, title: true, slug: true, _count: { select: { variants: true } } },
    });
    for (const p of heavyProducts) {
      if (p._count.variants > 200) {
        console.log(`Found heavy product "${p.title}" (${p.slug}) with ${p._count.variants} variants. Cleaning...`);
        await cleanupProductVariants(p.id);
      }
    }
    return;
  }

  console.log(`Found product "${product.title}" with ${product._count.variants} variants.`);
  await cleanupProductVariants(product.id);
}

async function cleanupProductVariants(productId: string) {
  console.log(`Cleaning up variants and relations for productId: ${productId}...`);
  await prisma.$executeRawUnsafe(`
    DELETE FROM product_variant_attribute_values WHERE "variantId" IN (SELECT id FROM product_variants WHERE "productId" = '${productId}');
  `);
  console.log("Deleted variant attribute values.");

  await prisma.$executeRawUnsafe(`
    DELETE FROM product_prices WHERE "variantId" IN (SELECT id FROM product_variants WHERE "productId" = '${productId}');
  `);
  console.log("Deleted variant prices.");

  await prisma.$executeRawUnsafe(`
    DELETE FROM inventory WHERE "variantId" IN (SELECT id FROM product_variants WHERE "productId" = '${productId}');
  `);
  console.log("Deleted variant inventory.");

  await prisma.$executeRawUnsafe(`
    DELETE FROM product_variants WHERE "productId" = '${productId}';
  `);
  console.log("Deleted product variants.");

  console.log("Cleanup completed successfully!");
}

main()
  .catch((err) => {
    console.error("Error during cleanup:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
