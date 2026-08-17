import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const p = await prisma.product.findUnique({
    where: { id: "cmrdbrbuc0001c6ygh7mowjar" },
    select: {
      id: true,
      title: true,
      slug: true,
      isFeatured: true,
      status: true,
    }
  });
  console.log("Test Product 1 DB record:", p);
}

main().catch(console.error).finally(() => prisma.$disconnect());
