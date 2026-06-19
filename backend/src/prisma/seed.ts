import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database…");

  // ─── Roles ──────────────────────────────────────────────
  const superAdminRole = await prisma.role.upsert({
    where: { name: "Super Admin" },
    update: {},
    create: { name: "Super Admin", permissions: ["*"] },
  });

  const adminRole = await prisma.role.upsert({
    where: { name: "Admin" },
    update: {},
    create: {
      name: "Admin",
      permissions: ["products.create", "products.update", "products.delete", "orders.manage", "quotes.manage", "inventory.manage", "settings.manage"],
    },
  });

  const staffRole = await prisma.role.upsert({
    where: { name: "Staff" },
    update: {},
    create: { name: "Staff", permissions: ["products.view", "orders.view", "quotes.view"] },
  });

  // ─── Super admin user ───────────────────────────────────
  const password = await bcrypt.hash("Admin@1234", 12);
  await prisma.user.upsert({
    where: { email: "admin@modortho.com" },
    update: {},
    create: { name: "Super Admin", email: "admin@modortho.com", password, roleId: superAdminRole.id },
  });

  // ─── Base currency ──────────────────────────────────────
  const usd = await prisma.currency.upsert({
    where: { code: "USD" },
    update: {},
    create: { name: "US Dollar", code: "USD", symbol: "$", exchangeRate: 1, isBase: true },
  });

  const inr = await prisma.currency.upsert({
    where: { code: "INR" },
    update: {},
    create: { name: "Indian Rupee", code: "INR", symbol: "₹", exchangeRate: 83.5 },
  });

  const eur = await prisma.currency.upsert({
    where: { code: "EUR" },
    update: {},
    create: { name: "Euro", code: "EUR", symbol: "€", exchangeRate: 0.92 },
  });

  const gbp = await prisma.currency.upsert({
    where: { code: "GBP" },
    update: {},
    create: { name: "British Pound", code: "GBP", symbol: "£", exchangeRate: 0.79 },
  });

  // ─── Default countries ──────────────────────────────────
  await prisma.country.upsert({
    where: { code: "IN" },
    update: {},
    create: { name: "India", code: "IN", currencyId: inr.id, isDefault: true },
  });
  await prisma.country.upsert({ where: { code: "US" }, update: {}, create: { name: "United States", code: "US", currencyId: usd.id } });
  await prisma.country.upsert({ where: { code: "GB" }, update: {}, create: { name: "United Kingdom", code: "GB", currencyId: gbp.id } });
  await prisma.country.upsert({ where: { code: "DE" }, update: {}, create: { name: "Germany", code: "DE", currencyId: eur.id } });
  await prisma.country.upsert({ where: { code: "AU" }, update: {}, create: { name: "Australia", code: "AU", currencyId: usd.id } });

  // ─── Default language ────────────────────────────────────
  await prisma.language.upsert({
    where: { code: "en" },
    update: {},
    create: { name: "English", code: "en", isDefault: true },
  });

  // ─── Payment gateways ────────────────────────────────────
  await prisma.paymentGateway.upsert({
    where: { provider: "RAZORPAY" },
    update: {},
    create: { provider: "RAZORPAY", displayName: "Razorpay", isEnabled: false, countries: ["IN"] },
  });
  await prisma.paymentGateway.upsert({
    where: { provider: "STRIPE" },
    update: {},
    create: { provider: "STRIPE", displayName: "Stripe", isEnabled: false, countries: [] },
  });

  // ─── Default product attributes ──────────────────────────
  const attrs = [
    { name: "Prescription", values: ["MBT", "Roth", "Standard Edgewise", "Bio-Progressive"] },
    { name: "Slot Size", values: [".018\"", ".022\""] },
    { name: "Arch", values: ["Upper", "Lower"] },
    { name: "Pack Size", values: ["Single", "5 Pack", "10 Pack", "50 Pack"] },
    { name: "Material", values: ["Stainless Steel", "NiTi", "Ceramic", "TMA Beta Titanium"] },
  ];

  for (const attr of attrs) {
    const a = await prisma.attribute.upsert({
      where: { slug: attr.name.toLowerCase().replace(/\s+/g, "-") },
      update: {},
      create: { name: attr.name, slug: attr.name.toLowerCase().replace(/[^\w]/g, "-") },
    });
    for (let i = 0; i < attr.values.length; i++) {
      const slug = attr.values[i].toLowerCase().replace(/[^\w]/g, "-");
      await prisma.attributeValue.upsert({
        where: { attributeId_slug: { attributeId: a.id, slug } },
        update: {},
        create: { attributeId: a.id, value: attr.values[i], slug, sortOrder: i },
      });
    }
  }

  console.log(`✅ Seed complete.`);
  console.log(`   Admin login: admin@modortho.com / Admin@1234`);
  console.log(`   Roles created: Super Admin, Admin, Staff`);
}

main()
  .catch((err) => { console.error("Seed failed:", err); process.exit(1); })
  .finally(() => prisma.$disconnect());
