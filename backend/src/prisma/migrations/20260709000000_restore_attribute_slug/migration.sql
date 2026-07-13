-- Restore attributes.slug because the Prisma schema and public product API expect it.
-- An earlier migration dropped this column, which breaks product detail API queries.

ALTER TABLE "attributes" ADD COLUMN IF NOT EXISTS "slug" TEXT;

WITH slug_source AS (
  SELECT
    "id",
    COALESCE(
      NULLIF(
        regexp_replace(
          regexp_replace(lower(trim("name")), '[^a-z0-9]+', '-', 'g'),
          '(^-|-$)',
          '',
          'g'
        ),
        ''
      ),
      'attribute'
    ) AS base_slug
  FROM "attributes"
  WHERE "slug" IS NULL OR trim("slug") = ''
),
numbered AS (
  SELECT
    "id",
    base_slug,
    row_number() OVER (PARTITION BY base_slug ORDER BY "id") AS row_number
  FROM slug_source
)
UPDATE "attributes" AS attribute
SET "slug" = CASE
  WHEN numbered.row_number = 1 THEN numbered.base_slug
  ELSE numbered.base_slug || '-' || numbered.row_number::text
END
FROM numbered
WHERE attribute."id" = numbered."id";

ALTER TABLE "attributes" ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "attributes_slug_key" ON "attributes"("slug");
