import "../config/env";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const p = await prisma.product.findFirst({
    where: { slug: "modortho-adjustable-hinged-knee-support" },
    include: {
      prices: { include: { currency: true, country: true } },
      inventories: true,
      media: true,
      countries: true,
      category: true,
    },
  });
  console.log(JSON.stringify(p, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});