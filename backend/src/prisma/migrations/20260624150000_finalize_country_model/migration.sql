-- CreateEnum
CREATE TYPE "CountryStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterTable
ALTER TABLE "countries" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "countries" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "countries" ALTER COLUMN "status" TYPE "CountryStatus" USING ("status"::text::"CountryStatus");
ALTER TABLE "countries" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
