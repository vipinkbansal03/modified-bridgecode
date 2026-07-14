-- DropIndex
DROP INDEX "orders_customerId_idx";

-- AlterTable
ALTER TABLE "attributes" ALTER COLUMN "role" SET DEFAULT 'DROPDOWN';

-- CreateTable
CREATE TABLE "contact_submissions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "company" TEXT,
    "subject" TEXT,
    "type" TEXT,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_submissions_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "inventory" ADD CONSTRAINT "inventory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
