-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('RETAIL', 'DEALER', 'DOCTOR', 'WHOLESALE');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('ACTIVE', 'PENDING_APPROVAL', 'SUSPENDED');

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "customerType" "CustomerType" NOT NULL DEFAULT 'RETAIL';
