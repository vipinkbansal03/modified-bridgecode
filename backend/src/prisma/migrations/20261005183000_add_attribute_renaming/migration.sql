-- AlterTable Attribute
ALTER TABLE "attributes" ADD COLUMN IF NOT EXISTS "previousName" TEXT;
ALTER TABLE "attributes" ADD COLUMN IF NOT EXISTS "renamedAt" TIMESTAMP(3);

-- AlterTable AttributeValue
ALTER TABLE "attribute_values" ADD COLUMN IF NOT EXISTS "previousValue" TEXT;
ALTER TABLE "attribute_values" ADD COLUMN IF NOT EXISTS "renamedAt" TIMESTAMP(3);
