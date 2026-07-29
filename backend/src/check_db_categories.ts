import { prisma } from "./config/database";

async function main() {
  const categories = await prisma.category.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, slug: true, parentId: true }
  });
  console.log("=== ACTIVE CATEGORIES IN DB ===");
  console.log(JSON.stringify(categories, null, 2));

  const products = await prisma.product.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, title: true, categoryId: true }
  });
  console.log("\n=== ACTIVE PRODUCTS IN DB ===");
  console.log(JSON.stringify(products, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
