-- CreateEnum
CREATE TYPE "GridRole" AS ENUM ('ROW', 'COLUMN');

-- AlterTable
ALTER TABLE "attribute_values" ADD COLUMN "gridRole" "GridRole";
ALTER TABLE "attribute_values" ADD COLUMN "countryId" TEXT;
ALTER TABLE "attribute_values" ADD COLUMN "moq" INTEGER;
ALTER TABLE "attribute_values" ADD COLUMN "tierPrice" DECIMAL(10, 2);
ALTER TABLE "attribute_values" ADD COLUMN "dealerPrice" DECIMAL(10, 2);
ALTER TABLE "attribute_values" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "attribute_values" ALTER COLUMN "status" TYPE "AttributeStatus" USING ("status"::text::"AttributeStatus");
ALTER TABLE "attribute_values" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';

-- AddForeignKey
ALTER TABLE "attribute_values" ADD CONSTRAINT "attribute_values_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
