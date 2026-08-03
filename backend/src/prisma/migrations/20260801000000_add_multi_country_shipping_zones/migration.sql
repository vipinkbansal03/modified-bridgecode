-- CreateTable
CREATE TABLE "shipping_zone_countries" (
    "id" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipping_zone_countries_pkey" PRIMARY KEY ("id")
);

-- Backfill existing single-country zones into the join table
INSERT INTO "shipping_zone_countries" ("id", "zoneId", "countryId")
SELECT "id" || '_' || "countryId", "id", "countryId" FROM "shipping_zones";

-- CreateIndex
CREATE UNIQUE INDEX "shipping_zone_countries_zoneId_countryId_key" ON "shipping_zone_countries"("zoneId", "countryId");

-- AddForeignKey
ALTER TABLE "shipping_zone_countries" ADD CONSTRAINT "shipping_zone_countries_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "shipping_zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipping_zone_countries" ADD CONSTRAINT "shipping_zone_countries_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DropForeignKey
ALTER TABLE "shipping_zones" DROP CONSTRAINT "shipping_zones_countryId_fkey";

-- DropIndex
DROP INDEX "shipping_zones_providerId_countryId_key";

-- AlterTable
ALTER TABLE "shipping_zones" DROP COLUMN "countryId";
