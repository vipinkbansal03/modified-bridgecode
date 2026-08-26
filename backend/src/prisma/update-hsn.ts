import "../config/env";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("Updating product HSN codes...");
  // 1. Update elfin-bondable-molar-tube
  const productElfin = await prisma.product.updateMany({
    where: { slug: "elfin-bondable-molar-tube" },
    data: { hsnCode: "9021.10" },
  });
  console.log(`Updated product: ${productElfin.count}`);

  // 2. Update elfin order items
  const product = await prisma.product.findFirst({
    where: { slug: "elfin-bondable-molar-tube", deletedAt: null },
  });
  if (product) {
    const itemsElfin = await prisma.orderItem.updateMany({
      where: { productId: product.id },
      data: { hsnCode: "9021.10" },
    });
    console.log(`Updated OrderItems: ${itemsElfin.count}`);
  }

  // 3. Update niti-wire-product
  const productNiti = await prisma.product.updateMany({
    where: { slug: "niti-wire-product", deletedAt: null },
    data: { hsnCode: "9018.49" },
  });
  console.log(`Updated product: ${productNiti.count}`);

  const nitiProd = await prisma.product.findFirst({
    where: { slug: "niti-wire-product", deletedAt: null },
  });
  if (nitiProd) {
    const itemsNiti = await prisma.orderItem.updateMany({
      where: { productId: nitiProd.id },
      data: { hsnCode: "9018.49" },
    });
    console.log(`Updated OrderItems: ${itemsNiti.count}`);
  }

  console.log("Database update completed.");
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
