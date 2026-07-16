import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const t1 = "Roth / .018 / Hook 4 / .019 x .025 / Loose Molar Tubes";
  const t2 = "Roth / .022 / Hook 4 / .019 x .025 / Loose Molar Tubes";

  const v1s = await prisma.productVariant.findMany({ where: { title: t1 } });
  const v2s = await prisma.productVariant.findMany({ where: { title: t2 } });

  console.log(`Variants matching "${t1}":`, v1s.map(v => ({ id: v.id, sku: v.sku, productId: v.productId })));
  console.log(`Variants matching "${t2}":`, v2s.map(v => ({ id: v.id, sku: v.sku, productId: v.productId })));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
