-- CreateEnum
CREATE TYPE "AttributeRole" AS ENUM ('DROPDOWN', 'X_GRID', 'Y_GRID');

-- CreateEnum
CREATE TYPE "AttributeStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- DropIndex
DROP INDEX "attributes_slug_key";

-- AlterTable
ALTER TABLE "attributes" ADD COLUMN "role" "AttributeRole" NOT NULL DEFAULT 'DROPDOWN';
ALTER TABLE "attributes" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "attributes" DROP COLUMN "slug";
ALTER TABLE "attributes" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "attributes" ALTER COLUMN "status" TYPE "AttributeStatus" USING ("status"::text::"AttributeStatus");
ALTER TABLE "attributes" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
