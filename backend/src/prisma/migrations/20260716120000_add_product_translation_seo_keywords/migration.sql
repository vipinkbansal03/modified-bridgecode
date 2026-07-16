-- Add the missing SEO keywords column to keep product translations aligned with the Prisma schema.
ALTER TABLE "product_translations"
ADD COLUMN IF NOT EXISTS "seoKeywords" TEXT;