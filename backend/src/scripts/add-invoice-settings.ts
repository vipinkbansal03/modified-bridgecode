import "../config/env";
import { prisma } from "../config/database";

async function main() {
  console.log("Applying invoice columns to PostgreSQL database...");

  // 1. Add autoGenerateInvoice to countries
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "countries" 
    ADD COLUMN IF NOT EXISTS "autoGenerateInvoice" BOOLEAN NOT NULL DEFAULT true;
  `);

  // 2. Add invoice fields to orders
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "orders" 
    ADD COLUMN IF NOT EXISTS "isInvoiceGenerated" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS "invoiceType" TEXT DEFAULT 'AUTO',
    ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT,
    ADD COLUMN IF NOT EXISTS "invoiceDate" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "invoiceDueDate" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "invoiceUrl" TEXT,
    ADD COLUMN IF NOT EXISTS "invoiceOriginalName" TEXT,
    ADD COLUMN IF NOT EXISTS "invoiceData" JSONB;
  `);

  console.log("Successfully added all invoice fields to countries and orders tables!");
}

main()
  .catch((e) => {
    console.error("Migration error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
