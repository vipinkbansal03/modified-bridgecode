import { prisma } from "../backend/src/config/database";

async function main() {
  const categories = await prisma.category.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, slug: true, parentId: true }
  });
  console.log("=== ACTIVE CATEGORIES IN DB ===");
  console.log(categories);

  const products = await prisma.product.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, title: true, categoryId: true }
  });
  console.log("\n=== ACTIVE PRODUCTS IN DB ===");
  console.log(products);
}

main().catch(console.error).finally(() => prisma.$disconnect());
