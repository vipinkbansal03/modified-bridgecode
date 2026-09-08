-- AlterTable
ALTER TABLE "discounts" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "discounts_deletedAt_idx" ON "discounts"("deletedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "discounts_type_status_idx" ON "discounts"("type", "status");
