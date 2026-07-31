import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting backfill for Coupon, Banner, and TaxRule country mappings...");

  // 1. Backfill Coupons
  const coupons = await prisma.coupon.findMany({
    where: { countryId: { not: null } },
    select: { id: true, countryId: true },
  });
  let couponCount = 0;
  for (const coupon of coupons) {
    if (coupon.countryId) {
      await prisma.couponCountry.upsert({
        where: { couponId_countryId: { couponId: coupon.id, countryId: coupon.countryId } },
        create: { couponId: coupon.id, countryId: coupon.countryId },
        update: {},
      });
      couponCount++;
    }
  }
  console.log(`Backfilled ${couponCount} coupon country mappings.`);

  // 2. Backfill Banners
  const banners = await prisma.banner.findMany({
    where: { countryId: { not: null } },
    select: { id: true, countryId: true },
  });
  let bannerCount = 0;
  for (const banner of banners) {
    if (banner.countryId) {
      await prisma.bannerCountry.upsert({
        where: { bannerId_countryId: { bannerId: banner.id, countryId: banner.countryId } },
        create: { bannerId: banner.id, countryId: banner.countryId },
        update: {},
      });
      bannerCount++;
    }
  }
  console.log(`Backfilled ${bannerCount} banner country mappings.`);

  // 3. Backfill Tax Rules
  const taxRules = await prisma.taxRule.findMany({
    where: { countryId: { not: null } },
    select: { id: true, countryId: true },
  });
  let taxCount = 0;
  for (const rule of taxRules) {
    if (rule.countryId) {
      await prisma.taxRuleCountry.upsert({
        where: { taxRuleId_countryId: { taxRuleId: rule.id, countryId: rule.countryId } },
        create: { taxRuleId: rule.id, countryId: rule.countryId },
        update: {},
      });
      taxCount++;
    }
  }
  console.log(`Backfilled ${taxCount} tax rule country mappings.`);

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
