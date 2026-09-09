-- AlterTable
ALTER TABLE "attributes" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "attributes_deletedAt_idx" ON "attributes"("deletedAt");

-- Update unique index on slug to partial index where deletedAt IS NULL
ALTER TABLE "attributes" DROP CONSTRAINT IF EXISTS "attributes_slug_key";
DROP INDEX IF EXISTS "attributes_slug_key";
CREATE UNIQUE INDEX IF NOT EXISTS "attributes_slug_key" ON "attributes"("slug") WHERE "deletedAt" IS NULL;