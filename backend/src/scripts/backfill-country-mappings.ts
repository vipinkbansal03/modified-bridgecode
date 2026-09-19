import "../config/env";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting backfill for Coupon, Banner, and TaxRule country mappings...");

  // 1. Backfill Coupons
  const coupons = await prisma.coupon.findMany({
    where: { countryId: { not: null } },
    select: { id: true, countryId: true },
  });
  const couponRows = coupons
    .filter((c) => c.countryId)
    .map((c) => ({ couponId: c.id, countryId: c.countryId! }));

  // 2. Backfill Banners
  const banners = await prisma.banner.findMany({
    where: { countryId: { not: null } },
    select: { id: true, countryId: true },
  });
  const bannerRows = banners
    .filter((b) => b.countryId)
    .map((b) => ({ bannerId: b.id, countryId: b.countryId! }));

  // 3. Backfill Tax Rules
  const taxRules = await prisma.taxRule.findMany({
    where: { countryId: { not: null } },
    select: { id: true, countryId: true },
  });
  const taxRows = taxRules
    .filter((t) => t.countryId)
    .map((t) => ({ taxRuleId: t.id, countryId: t.countryId! }));

  await prisma.$transaction(async (tx) => {
    if (couponRows.length) {
      await tx.couponCountry.createMany({ data: couponRows, skipDuplicates: true });
    }
    if (bannerRows.length) {
      await tx.bannerCountry.createMany({ data: bannerRows, skipDuplicates: true });
    }
    if (taxRows.length) {
      await tx.taxRuleCountry.createMany({ data: taxRows, skipDuplicates: true });
    }
  });

  console.log(`Backfilled ${couponRows.length} coupon, ${bannerRows.length} banner, ${taxRows.length} tax rule country mappings.`);

  console.log("Backfill complete!");
}

main()
  .catch((e) => {
    console.error("Backfill failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
