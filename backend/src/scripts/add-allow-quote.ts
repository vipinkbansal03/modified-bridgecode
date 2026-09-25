import { prisma } from "../config/database";

async function main() {
  await prisma.$executeRawUnsafe('ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "allowQuote" BOOLEAN DEFAULT true;');
  await prisma.$executeRawUnsafe('UPDATE "products" SET "allowQuote" = true WHERE "allowQuote" IS NULL;');
  console.log("Successfully added allowQuote column to products table!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
