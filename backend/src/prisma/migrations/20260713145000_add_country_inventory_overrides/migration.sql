-- Add country-aware inventory overrides while preserving a single base row per variant.
ALTER TABLE "inventory"
ADD COLUMN "countryId" TEXT;

DROP INDEX IF EXISTS "inventory_variantId_key";

CREATE UNIQUE INDEX "inventory_variantId_base_key"
ON "inventory"("variantId")
WHERE "countryId" IS NULL;

CREATE UNIQUE INDEX "inventory_variantId_countryId_key"
ON "inventory"("variantId", "countryId")
WHERE "countryId" IS NOT NULL;

ALTER TABLE "inventory"
ADD CONSTRAINT "inventory_countryId_fkey"
FOREIGN KEY ("countryId") REFERENCES "countries"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
