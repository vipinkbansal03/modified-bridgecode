-- AlterTable: Add deletedAt and isTest to orders for Order Soft Delete & Hard Delete safety
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "isTest" BOOLEAN NOT NULL DEFAULT false;

