-- AlterTable: Add deletedAt to tiers for Tier Soft Delete & Archive workflow
ALTER TABLE "tiers" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- Partial Unique Index (active tiers only)
CREATE UNIQUE INDEX IF NOT EXISTS "tiers_name_key" ON "tiers"("name") WHERE "deletedAt" IS NULL;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "tiers_deletedAt_idx" ON "tiers"("deletedAt");
