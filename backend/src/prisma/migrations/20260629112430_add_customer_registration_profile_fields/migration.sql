-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "companyName" TEXT,
ADD COLUMN     "currentPractice" TEXT,
ADD COLUMN     "currentPracticeOther" TEXT,
ADD COLUMN     "preferredPrescription" TEXT,
ADD COLUMN     "preferredPrescriptionOther" TEXT,
ADD COLUMN     "preferredSlot" TEXT,
ADD COLUMN     "usingModernProducts" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "website" TEXT;
