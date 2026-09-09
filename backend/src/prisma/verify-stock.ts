import "../config/env";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const inv = await prisma.inventory.findMany({
    where: { productId: "cmtshekcd0001tnk82u1ogl2s" },
    select: { id: true, stock: true, reservedStock: true, status: true, warehouseId: true, variantId: true },
  });
  console.log("Inventory:", JSON.stringify(inv, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });