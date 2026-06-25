-- CreateEnum
CREATE TYPE "GridAxis" AS ENUM ('ROW', 'COLUMN');

-- AlterTable
ALTER TABLE "product_attributes" ADD COLUMN     "gridAxis" "GridAxis";
