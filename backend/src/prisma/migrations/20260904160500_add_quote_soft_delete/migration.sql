-- AlterTable: Add deletedAt to quotes for Quote Soft Delete & Archive workflow
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "quotes_deletedAt_idx" ON "quotes"("deletedAt");
