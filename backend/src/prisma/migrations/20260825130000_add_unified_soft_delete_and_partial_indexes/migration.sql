-- AlterTable: Add deletedAt to models for Soft Delete historical retention
ALTER TABLE "warehouses" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "collections" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "attributes" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "attribute_values" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "tiers" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "customer_roles" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "coupons" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "shipping_zones" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "shipping_boxes" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "contact_submissions" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "product_reviews" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "cms_pages" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "banners" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "blogs" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "discounts" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "tax_rules" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- PostgreSQL Partial Unique Indexes (WHERE "deletedAt" IS NULL)

-- Categories: slug
ALTER TABLE "categories" DROP CONSTRAINT IF EXISTS "categories_slug_key";
DROP INDEX IF EXISTS "categories_slug_key";
CREATE UNIQUE INDEX IF NOT EXISTS "categories_slug_key" ON "categories"("slug") WHERE "deletedAt" IS NULL;

-- Products: slug & sku
ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_slug_key";
DROP INDEX IF EXISTS "products_slug_key";
CREATE UNIQUE INDEX IF NOT EXISTS "products_slug_key" ON "products"("slug") WHERE "deletedAt" IS NULL;

ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_sku_key";
DROP INDEX IF EXISTS "products_sku_key";
CREATE UNIQUE INDEX IF NOT EXISTS "products_sku_key" ON "products"("sku") WHERE "deletedAt" IS NULL AND "sku" IS NOT NULL;

-- Product Variants: sku
ALTER TABLE "product_variants" DROP CONSTRAINT IF EXISTS "product_variants_sku_key";
DROP INDEX IF EXISTS "product_variants_sku_key";
CREATE UNIQUE INDEX IF NOT EXISTS "product_variants_sku_key" ON "product_variants"("sku") WHERE "deletedAt" IS NULL AND "sku" IS NOT NULL;

-- Collections: slug
ALTER TABLE "collections" DROP CONSTRAINT IF EXISTS "collections_slug_key";
DROP INDEX IF EXISTS "collections_slug_key";
CREATE UNIQUE INDEX IF NOT EXISTS "collections_slug_key" ON "collections"("slug") WHERE "deletedAt" IS NULL;

-- Attributes: slug
ALTER TABLE "attributes" DROP CONSTRAINT IF EXISTS "attributes_slug_key";
DROP INDEX IF EXISTS "attributes_slug_key";
CREATE UNIQUE INDEX IF NOT EXISTS "attributes_slug_key" ON "attributes"("slug") WHERE "deletedAt" IS NULL;

-- Attribute Values: compound (attributeId, slug)
ALTER TABLE "attribute_values" DROP CONSTRAINT IF EXISTS "attribute_values_attributeId_slug_key";
DROP INDEX IF EXISTS "attribute_values_attributeId_slug_key";
CREATE UNIQUE INDEX IF NOT EXISTS "attribute_values_attributeId_slug_key" ON "attribute_values"("attributeId", "slug") WHERE "deletedAt" IS NULL;

-- Coupons: code
ALTER TABLE "coupons" DROP CONSTRAINT IF EXISTS "coupons_code_key";
DROP INDEX IF EXISTS "coupons_code_key";
CREATE UNIQUE INDEX IF NOT EXISTS "coupons_code_key" ON "coupons"("code") WHERE "deletedAt" IS NULL;

-- CMS Pages: slug & pageKey
ALTER TABLE "cms_pages" DROP CONSTRAINT IF EXISTS "cms_pages_slug_key";
DROP INDEX IF EXISTS "cms_pages_slug_key";
CREATE UNIQUE INDEX IF NOT EXISTS "cms_pages_slug_key" ON "cms_pages"("slug") WHERE "deletedAt" IS NULL;

ALTER TABLE "cms_pages" DROP CONSTRAINT IF EXISTS "cms_pages_pageKey_key";
DROP INDEX IF EXISTS "cms_pages_pageKey_key";
CREATE UNIQUE INDEX IF NOT EXISTS "cms_pages_pageKey_key" ON "cms_pages"("pageKey") WHERE "deletedAt" IS NULL;

-- Blogs: slug
ALTER TABLE "blogs" DROP CONSTRAINT IF EXISTS "blogs_slug_key";
DROP INDEX IF EXISTS "blogs_slug_key";
CREATE UNIQUE INDEX IF NOT EXISTS "blogs_slug_key" ON "blogs"("slug") WHERE "deletedAt" IS NULL;

-- Customers: email
ALTER TABLE "customers" DROP CONSTRAINT IF EXISTS "customers_email_key";
DROP INDEX IF EXISTS "customers_email_key";
CREATE UNIQUE INDEX IF NOT EXISTS "customers_email_key" ON "customers"("email") WHERE "deletedAt" IS NULL;

-- Users: email
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_email_key";
DROP INDEX IF EXISTS "users_email_key";
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email") WHERE "deletedAt" IS NULL;

-- Customer Roles: key & name
ALTER TABLE "customer_roles" DROP CONSTRAINT IF EXISTS "customer_roles_key_key";
DROP INDEX IF EXISTS "customer_roles_key_key";
CREATE UNIQUE INDEX IF NOT EXISTS "customer_roles_key_key" ON "customer_roles"("key") WHERE "deletedAt" IS NULL;

ALTER TABLE "customer_roles" DROP CONSTRAINT IF EXISTS "customer_roles_name_key";
DROP INDEX IF EXISTS "customer_roles_name_key";
CREATE UNIQUE INDEX IF NOT EXISTS "customer_roles_name_key" ON "customer_roles"("name") WHERE "deletedAt" IS NULL;

-- Tiers: name
ALTER TABLE "tiers" DROP CONSTRAINT IF EXISTS "tiers_name_key";
DROP INDEX IF EXISTS "tiers_name_key";
CREATE UNIQUE INDEX IF NOT EXISTS "tiers_name_key" ON "tiers"("name") WHERE "deletedAt" IS NULL;
