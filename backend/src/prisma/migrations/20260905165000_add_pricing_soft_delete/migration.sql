-- AlterTable: Add deletedAt to product_prices, tier_pricing, and moq_pricing for Pricing Soft Delete & Archive workflow
ALTER TABLE "product_prices" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "product_prices_deletedAt_idx" ON "product_prices"("deletedAt");

ALTER TABLE "tier_pricing" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "tier_pricing_deletedAt_idx" ON "tier_pricing"("deletedAt");

ALTER TABLE "moq_pricing" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "moq_pricing_deletedAt_idx" ON "moq_pricing"("deletedAt");
