require("../../scripts/load-env.cjs");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  // 1. Upsert a shipping provider
  const provider = await prisma.shippingProvider.upsert({
    where: { name: "standard" },
    update: {
      displayName: "Standard Delivery",
      isEnabled: true
    },
    create: {
      name: "standard",
      displayName: "Standard Delivery",
      isEnabled: true
    }
  });
  console.log("Upserted shipping provider:", provider);

  // 2. Get all active countries
  const countries = await prisma.country.findMany();

  // 3. Create shipping zones for all countries
  const defaultRates = {
    IN: { charge: 100, freeAbove: 5000, estimatedDays: "2-4 days" },
    US: { charge: 10, freeAbove: 100, estimatedDays: "5-7 days" },
    GB: { charge: 8, freeAbove: 80, estimatedDays: "5-7 days" },
    DE: { charge: 9, freeAbove: 90, estimatedDays: "3-5 days" },
    AU: { charge: 12, freeAbove: 120, estimatedDays: "6-8 days" }
  };

  for (const country of countries) {
    const rate = defaultRates[country.code] || { charge: 10, freeAbove: 100, estimatedDays: "5-7 days" };
    const existing = await prisma.shippingZone.findFirst({
      where: {
        providerId: provider.id,
        countries: { some: { countryId: country.id } }
      }
    });
    if (existing) {
      const zone = await prisma.shippingZone.update({
        where: { id: existing.id },
        data: {
          charge: rate.charge,
          freeAbove: rate.freeAbove,
          estimatedDays: rate.estimatedDays,
          status: "ACTIVE"
        }
      });
      console.log(`Upserted shipping zone for ${country.code}:`, zone.id);
    } else {
      const zone = await prisma.shippingZone.create({
        data: {
          providerId: provider.id,
          charge: rate.charge,
          freeAbove: rate.freeAbove,
          estimatedDays: rate.estimatedDays,
          status: "ACTIVE",
          countries: { create: [{ countryId: country.id }] }
        }
      });
      console.log(`Upserted shipping zone for ${country.code}:`, zone.id);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
