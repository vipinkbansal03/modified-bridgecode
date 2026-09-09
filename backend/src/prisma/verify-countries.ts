import "../config/env";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const countries = await prisma.country.findMany({
    select: { id: true, name: true, code: true, status: true, isDefault: true },
    orderBy: { name: "asc" },
  });
  const active = countries.filter((c: any) => c.status === "ACTIVE");
  const inactive = countries.filter((c: any) => c.status !== "ACTIVE");
  console.log(`TOTAL: ${countries.length} | ACTIVE: ${active.length} | INACTIVE: ${inactive.length}`);
  console.log("\n--- ACTIVE ---");
  for (const c of active) console.log(`  ${c.code} | ${c.name} | default=${c.isDefault}`);
  console.log("\n--- INACTIVE ---");
  for (const c of inactive) console.log(`  ${c.code} | ${c.name} | default=${c.isDefault}`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });