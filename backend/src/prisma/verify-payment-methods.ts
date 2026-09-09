import "../config/env";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const methods = await prisma.paymentMethod.findMany({
    select: { id: true, code: true, name: true, type: true, isEnabled: true, countries: { select: { country: { select: { code: true } } } } },
  });
  console.log("PaymentMethods:", JSON.stringify(methods, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });