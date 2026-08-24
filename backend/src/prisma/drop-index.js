require("../../scripts/load-env.cjs");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  try {
    console.log("Dropping constraint/index if it exists...");
    await prisma.$executeRawUnsafe(`DROP INDEX IF EXISTS "inventory_variantId_countryId_key" CASCADE;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "inventory" DROP CONSTRAINT IF EXISTS "inventory_variantId_countryId_key" CASCADE;`);
    console.log("Successfully dropped index and constraint!");
  } catch (err) {
    console.error("Error dropping index:", err);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
