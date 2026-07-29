import { prisma } from "./config/database";

async function main() {
  const menus = await prisma.cMSMenu.findMany({
    include: {
      items: true
    }
  });
  console.log("=== ALL CMS MENUS ===");
  console.log(JSON.stringify(menus, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
