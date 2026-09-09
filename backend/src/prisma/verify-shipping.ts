import "../config/env";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const providers = await prisma.shippingProvider.findMany({ select: { id: true, name: true, displayName: true, isEnabled: true } });
  console.log("Providers:", JSON.stringify(providers, null, 2));
  const zones = await prisma.shippingZone.findMany({
    select: { id: true, charge: true, freeAbove: true, status: true, estimatedDays: true, providerId: true, countries: { select: { country: { select: { code: true } } } } },
  });
  console.log("Zones:", JSON.stringify(zones, null, 2));
  const boxes = await prisma.shippingBox.count();
  const zoneCountries = await prisma.shippingZoneCountry.findMany();
  console.log("ZoneCountries:", zoneCountries.length);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });