import "../config/env";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const r = await prisma.product.findUnique({
    where: { id: "cmtshekcd0001tnk82u1ogl2s" },
    select: { packageWeight: true, packageLength: true, packageWidth: true, packageHeight: true, shippingClass: true, fragile: true, hazardous: true },
  });
  console.log("Product dims:", JSON.stringify(r, null, 2));
  const boxes = await prisma.shippingBox.findMany();
  console.log("boxes:", boxes.length);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });