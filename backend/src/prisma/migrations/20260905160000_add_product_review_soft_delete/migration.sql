-- AlterTable: Add deletedAt to product_reviews for Product Review Soft Delete & Archive workflow
ALTER TABLE "product_reviews" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "product_reviews_deletedAt_idx" ON "product_reviews"("deletedAt");
