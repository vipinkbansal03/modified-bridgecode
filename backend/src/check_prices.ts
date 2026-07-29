import { prisma } from "./config/database";

async function main() {
  const prices = await prisma.productPrice.findMany({
    include: {
      product: { select: { title: true } },
      country: { select: { name: true, code: true } },
      currency: { select: { code: true } }
    }
  });
  console.log("=== ALL PRODUCT PRICES ===");
  console.log(JSON.stringify(prices, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
