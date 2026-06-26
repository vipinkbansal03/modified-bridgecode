-- CreateEnum
CREATE TYPE "TranslationStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "product_translations" ADD COLUMN "status" "TranslationStatus" NOT NULL DEFAULT 'APPROVED';

-- AlterTable
ALTER TABLE "category_translations" ADD COLUMN "status" "TranslationStatus" NOT NULL DEFAULT 'APPROVED';
ALTER TABLE "category_translations" ADD COLUMN "reviewedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "protected_keywords" (
    "id" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "protected_keywords_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "protected_keywords_term_key" ON "protected_keywords"("term");
