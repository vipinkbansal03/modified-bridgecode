import "../config/env";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const countries = await prisma.country.findMany({
    select: { id: true, code: true, name: true }
  });
  console.log("=== Countries in DB ===");
  console.log(countries);

  const product = await prisma.product.findFirst({
    where: { slug: "elfin-bondable-molar-tube" }
  });
  if (!product) {
    console.log("Elfin product not found!");
    return;
  }
  console.log(`\n=== Product: ${product.title} (ID: ${product.id}) ===`);

  const productCountries = await prisma.productCountry.findMany({
    where: { productId: product.id },
    include: { country: true }
  });
  console.log("\n=== Product Countries ===");
  console.log(productCountries.map((pc: any) => ({ code: pc.country.code, enabled: pc.enabled })));

  const variant = await prisma.productVariant.findFirst({
    where: { sku: "ELFIN-L-Roth-022-H4-019025" }
  });
  if (variant) {
    console.log(`\n=== Variant: ${variant.title} (SKU: ${variant.sku}, ID: ${variant.id}) ===`);
    const variantCountries = await prisma.variantCountry.findMany({
      where: { variantId: variant.id },
      include: { country: true }
    });
    console.log("=== Variant Countries ===");
    console.log(variantCountries.map((vc: any) => ({ code: vc.country.code, enabled: vc.enabled })));
  } else {
    console.log("\nVariant ELFIN-L-Roth-022-H4-019025 not found!");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
