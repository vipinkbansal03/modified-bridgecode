import "../config/env";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const india = await prisma.country.findFirst({ where: { code: "IN" } });
  if (!india) {
    console.error("India not found");
    process.exit(1);
  }
  await prisma.$transaction(async (tx) => {
    await tx.country.updateMany({ data: { isDefault: false } });
    await tx.country.update({
      where: { id: india.id },
      data: { status: "ACTIVE", isDefault: true },
    });
  });
  const check = await prisma.country.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, code: true, isDefault: true },
  });
  console.log("ACTIVE countries now:", JSON.stringify(check, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });