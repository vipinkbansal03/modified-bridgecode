import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const settings = await prisma.setting.findMany({
    where: {
      key: {
        startsWith: "social",
      },
    },
  });
  console.log("=== DB SOCIAL SETTINGS ===");
  console.log(JSON.stringify(settings, null, 2));
  
  const defaultCountry = await prisma.country.findFirst({ where: { isDefault: true } });
  console.log("=== DEFAULT COUNTRY ===");
  console.log(defaultCountry);
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
