import "../config/env";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const taxRules = await (prisma as any).taxRule.findMany({
    include: {
      countries: { select: { countryId: true, country: { select: { code: true } } } },
      products: { select: { id: true } },
      categories: { select: { id: true } },
      variants: { select: { id: true } },
    },
  });
  console.log(`TaxRule count: ${taxRules.length}`);
  for (const r of taxRules) {
    console.log(JSON.stringify({
      id: r.id, name: r.name, type: r.type, percentage: r.percentage,
      taxMode: r.taxMode, status: r.status, sortOrder: r.sortOrder,
      countries: r.countries.map((c: any) => c.country?.code),
      products: r.products.length, categories: r.categories.length, variants: r.variants.length,
    }));
  }

  const settings = await prisma.setting.findMany({ select: { key: true, value: true } });
  console.log("\nSettings count:", settings.length);
  for (const s of settings) {
    if (/tax/i.test(s.key)) console.log("  tax setting:", s.key, "=", s.value);
  }

  const pr = await prisma.productPrice.findFirst({
    where: { productId: "cmtshekcd0001tnk82u1ogl2s" },
    select: { taxPercentage: true, mrp: true, sellingPrice: true, country: { select: { code: true } } },
  });
  console.log("\nDummy product price record:", JSON.stringify(pr));
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });