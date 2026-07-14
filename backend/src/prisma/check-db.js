const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const providers = await prisma.shippingProvider.findMany();
  console.log("=== Shipping Providers ===");
  console.log(providers);

  const zones = await prisma.shippingZone.findMany({
    include: { country: true, provider: true }
  });
  console.log("\n=== Shipping Zones ===");
  console.log(zones.map(z => ({
    id: z.id,
    name: z.name,
    charge: z.charge.toString(),
    freeAbove: z.freeAbove?.toString(),
    status: z.status,
    countryCode: z.country?.code,
    providerName: z.provider?.name
  })));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
