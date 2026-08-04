-- Drop the old problematic partial indexes
DROP INDEX IF EXISTS "inventory_variantId_base_key";
DROP INDEX IF EXISTS "inventory_variantId_countryId_key";

-- Recreate the correct partial indexes
-- Base Inventory (no country override, no warehouse override)
CREATE UNIQUE INDEX "inventory_variantId_base_key" ON "inventory" ("variantId") WHERE ("countryId" IS NULL AND "warehouseId" IS NULL);

-- Country Override Inventory (country override, no warehouse override)
CREATE UNIQUE INDEX "inventory_variantId_countryId_key" ON "inventory" ("variantId", "countryId") WHERE ("countryId" IS NOT NULL AND "warehouseId" IS NULL);
