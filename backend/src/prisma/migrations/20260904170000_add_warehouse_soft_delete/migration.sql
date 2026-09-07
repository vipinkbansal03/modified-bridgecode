-- AlterTable: Add deletedAt to warehouses for Warehouse Soft Delete & Archive workflow
ALTER TABLE "warehouses" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "warehouses_deletedAt_idx" ON "warehouses"("deletedAt");
