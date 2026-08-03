ALTER TABLE "products" ADD COLUMN "fragile" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "products" ADD COLUMN "hazardous" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "products" ADD COLUMN "shippingClass" TEXT;
-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN "shippingClass" TEXT;
ALTER TABLE "product_variants" ADD COLUMN "fragile" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "product_variants" ADD COLUMN "hazardous" BOOLEAN NOT NULL DEFAULT false;

-- Backfill legacy variants with their product's fragile/hazardous defaults so
-- variant-first resolution preserves existing behaviour for pre-existing data.
UPDATE "product_variants" pv
SET "fragile" = p."fragile",
    "hazardous" = p."hazardous"
FROM "products" p
WHERE p."id" = pv."productId";

