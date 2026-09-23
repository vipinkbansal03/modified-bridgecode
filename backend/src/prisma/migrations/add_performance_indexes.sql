-- ==============================================================================
-- Migration: Add Performance Foreign Key & Composite Indexes
-- Target Database: PostgreSQL (RDS / Production / Staging)
-- Description: Adds essential foreign-key and filter indexes to eliminate sequential
--              scans and resolve timeouts when querying products with large variant,
--              pricing, and inventory datasets.
-- All statements are idempotent (CREATE INDEX IF NOT EXISTS).
-- ==============================================================================

-- 1. Products
CREATE INDEX IF NOT EXISTS "idx_products_status_deleted" ON "products" ("status", "deletedAt");
CREATE INDEX IF NOT EXISTS "idx_products_category_id" ON "products" ("categoryId");
CREATE INDEX IF NOT EXISTS "idx_products_deleted_at" ON "products" ("deletedAt");

-- 2. Product Variants
CREATE INDEX IF NOT EXISTS "idx_product_variants_product_id" ON "product_variants" ("productId");
CREATE INDEX IF NOT EXISTS "idx_product_variants_prod_status_del" ON "product_variants" ("productId", "status", "deletedAt");
CREATE INDEX IF NOT EXISTS "idx_product_variants_variant_key" ON "product_variants" ("variantKey");
CREATE INDEX IF NOT EXISTS "idx_product_variants_package_id" ON "product_variants" ("packageId");
CREATE INDEX IF NOT EXISTS "idx_product_variants_deleted_at" ON "product_variants" ("deletedAt");

-- 3. Product Prices
CREATE INDEX IF NOT EXISTS "idx_product_prices_variant_id" ON "product_prices" ("variantId");
CREATE INDEX IF NOT EXISTS "idx_product_prices_prod_del" ON "product_prices" ("productId", "deletedAt");
CREATE INDEX IF NOT EXISTS "idx_product_prices_var_del" ON "product_prices" ("variantId", "deletedAt");
CREATE INDEX IF NOT EXISTS "idx_product_prices_country_id" ON "product_prices" ("countryId");
CREATE INDEX IF NOT EXISTS "idx_product_prices_prod_country" ON "product_prices" ("productId", "countryId");

-- 4. Inventory
CREATE INDEX IF NOT EXISTS "idx_inventory_product_id" ON "inventory" ("productId");
CREATE INDEX IF NOT EXISTS "idx_inventory_variant_id" ON "inventory" ("variantId");
CREATE INDEX IF NOT EXISTS "idx_inventory_warehouse_id" ON "inventory" ("warehouseId");
CREATE INDEX IF NOT EXISTS "idx_inventory_country_id" ON "inventory" ("countryId");

-- 5. Product Media
CREATE INDEX IF NOT EXISTS "idx_product_media_product_id" ON "product_media" ("productId");
CREATE INDEX IF NOT EXISTS "idx_product_media_prod_sort" ON "product_media" ("productId", "sortOrder");

-- 6. Product Packages
CREATE INDEX IF NOT EXISTS "idx_product_packages_product_id" ON "product_packages" ("productId");

-- 7. Product Attributes & Mappings
CREATE INDEX IF NOT EXISTS "idx_product_attributes_product_id" ON "product_attributes" ("productId");
CREATE INDEX IF NOT EXISTS "idx_product_attributes_attribute_id" ON "product_attributes" ("attributeId");

-- 8. Product Variant Attribute Values & Selections
CREATE INDEX IF NOT EXISTS "idx_pvav_variant_id" ON "product_variant_attribute_values" ("variantId");
CREATE INDEX IF NOT EXISTS "idx_pvav_attribute_id" ON "product_variant_attribute_values" ("attributeId");
CREATE INDEX IF NOT EXISTS "idx_pvav_attribute_value_id" ON "product_variant_attribute_values" ("attributeValueId");
CREATE INDEX IF NOT EXISTS "idx_pavs_prod_attr_id" ON "product_attribute_value_selections" ("productAttributeId");
CREATE INDEX IF NOT EXISTS "idx_pavs_attr_val_id" ON "product_attribute_value_selections" ("attributeValueId");

-- 9. Product & Variant Countries
CREATE INDEX IF NOT EXISTS "idx_product_countries_prod_id" ON "product_countries" ("productId");
CREATE INDEX IF NOT EXISTS "idx_product_countries_country_id" ON "product_countries" ("countryId");
CREATE INDEX IF NOT EXISTS "idx_product_countries_prod_country_en" ON "product_countries" ("productId", "countryId", "enabled");
CREATE INDEX IF NOT EXISTS "idx_variant_countries_var_id" ON "variant_countries" ("variantId");
CREATE INDEX IF NOT EXISTS "idx_variant_countries_country_id" ON "variant_countries" ("countryId");
CREATE INDEX IF NOT EXISTS "idx_variant_countries_var_country_en" ON "variant_countries" ("variantId", "countryId", "enabled");

-- 10. Tier & MOQ Pricing
CREATE INDEX IF NOT EXISTS "idx_tier_pricing_product_id" ON "tier_pricing" ("productId");
CREATE INDEX IF NOT EXISTS "idx_tier_pricing_variant_id" ON "tier_pricing" ("variantId");
CREATE INDEX IF NOT EXISTS "idx_tier_pricing_tier_id" ON "tier_pricing" ("tierId");
CREATE INDEX IF NOT EXISTS "idx_tier_pricing_country_id" ON "tier_pricing" ("countryId");
CREATE INDEX IF NOT EXISTS "idx_moq_pricing_product_id" ON "moq_pricing" ("productId");
CREATE INDEX IF NOT EXISTS "idx_moq_pricing_variant_id" ON "moq_pricing" ("variantId");
CREATE INDEX IF NOT EXISTS "idx_moq_pricing_country_id" ON "moq_pricing" ("countryId");

-- 11. CMS Pages Unique Index fix (ensures unconditional unique constraint for Prisma upserts)
DROP INDEX IF EXISTS "cms_pages_pageKey_key";
CREATE UNIQUE INDEX IF NOT EXISTS "cms_pages_pageKey_key" ON "cms_pages"("pageKey");
