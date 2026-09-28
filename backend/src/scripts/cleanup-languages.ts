import { prisma } from "../config/database";

async function main() {
  console.log("Cleaning up non-English languages from database...");

  const nonEnglish = await prisma.language.findMany({
    where: {
      code: {
        in: ["de", "es", "German", "Spanish", "DE", "ES"],
      },
    },
  });

  for (const lang of nonEnglish) {
    console.log(`Deleting language: ${lang.name} (${lang.code})...`);
    await prisma.productTranslation.deleteMany({ where: { languageId: lang.id } });
    await prisma.categoryTranslation.deleteMany({ where: { languageId: lang.id } });
    await prisma.translationKeyword.deleteMany({ where: { languageId: lang.id } });
    await prisma.language.delete({ where: { id: lang.id } });
  }

  // Ensure English is present and set as default
  await prisma.language.upsert({
    where: { code: "en" },
    update: { name: "English", isDefault: true, isEnabled: true },
    create: { name: "English", code: "en", isDefault: true, isEnabled: true },
  });

  const remaining = await prisma.language.findMany();
  console.log(
    "Remaining languages in DB:",
    remaining.map((l: { name: string; code: string; isDefault: boolean }) => `${l.name} (${l.code}) [default: ${l.isDefault}]`),
  );
  console.log("Cleanup completed successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
