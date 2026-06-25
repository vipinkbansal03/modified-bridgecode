-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "customerId" TEXT;

-- Backfill exact email matches for existing customer orders.
UPDATE "orders" AS o
SET "customerId" = c.id
FROM "customers" AS c
WHERE o."customerId" IS NULL
  AND o."customerEmail" = c.email;

-- CreateIndex
CREATE INDEX "orders_customerId_idx" ON "orders"("customerId");

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
