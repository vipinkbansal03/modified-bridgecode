import "../config/env";
import { PaymentMethodType, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s.-]/g, "")
    .replace(/[\s_.]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function main() {
  console.log("🦿 Seeding dummy Knee Support product…");

  // ─── Ensure category exists ──────────────────────────────
  let category = await prisma.category.findFirst({
    where: { slug: "knee-supports", deletedAt: null },
  });
  if (!category) {
    category = await prisma.category.create({
      data: {
        name: "Knee Supports",
        slug: "knee-supports",
        description: "Adjustable and hinged knee support products for stability and compression.",
        status: "ACTIVE",
        sortOrder: 10,
      },
    });
    console.log(`  ✓ Created category: ${category.name} (${category.id})`);
  } else {
    console.log(`  ✓ Category already exists: ${category.name} (${category.id})`);
  }

  // ─── Get India country + INR currency ────────────────────
  const india = await prisma.country.findUnique({ where: { code: "IN" } });
  if (!india) throw new Error("India country not found. Run seed first.");
  const inr = await prisma.currency.findUnique({ where: { code: "INR" } });
  if (!inr) throw new Error("INR currency not found. Run seed first.");
  const usd = await prisma.currency.findUnique({ where: { code: "USD" } });
  const usCountry = await prisma.country.findUnique({ where: { code: "US" } });

  // ─── Create product ──────────────────────────────────────
  const productSlug = "modortho-adjustable-hinged-knee-support";
  const existingProduct = await prisma.product.findFirst({
    where: { slug: productSlug, deletedAt: null },
  });

  const productData = {
    title: "ModOrtho Adjustable Hinged Knee Support",
    slug: productSlug,
    shortDescription:
      "Adjustable hinged knee support designed to provide compression, stability, and comfortable support during daily activities and physical movement.",
    description:
      "The ModOrtho Adjustable Hinged Knee Support is designed to provide comfortable compression and additional knee stability. Its adjustable straps allow users to customize the fit, while the hinged construction provides controlled support during movement.\n\nIt is suitable for users looking for additional knee support during everyday activities, exercise, rehabilitation, or physical movement.\n\nThe product is designed with an adjustable fit and breathable support material for comfortable extended use.",
    categoryId: category.id,
    sku: "MOD-KNEE-HINGE-001",
    productCode: "MOD-KNEE-001",
    hsnCode: "9021.10",
    brand: "ModOrtho",
    status: "ACTIVE" as const,
    hasVariants: false,
    isFeatured: true,
    defaultCountryId: india.id,
    defaultCurrencyId: inr.id,
    seoTitle: "ModOrtho Adjustable Hinged Knee Support | Knee Support",
    seoDescription:
      "Shop the ModOrtho Adjustable Hinged Knee Support with adjustable compression and hinged stability for comfortable knee support.",
    seoKeywords: "knee support, hinged knee support, adjustable knee brace, ModOrtho knee support",
    highlights: [
      { title: "Adjustable compression", description: "Customize the compression level with adjustable straps for a personalized fit." },
      { title: "Hinged lateral support", description: "Provides controlled lateral stability during movement." },
      { title: "Breathable material", description: "Designed with breathable support material for comfortable extended wear." },
    ],
    technicalSpecs: [
      { label: "Product Type", value: "Hinged Knee Support" },
      { label: "Material", value: "Neoprene / Elastic Support Fabric" },
      { label: "Color", value: "Black" },
      { label: "Size", value: "Universal Adjustable" },
      { label: "Laterality", value: "Universal" },
      { label: "Support Level", value: "Moderate" },
      { label: "Approximate Weight", value: "250 g" },
      { label: "Country of Origin", value: "India" },
    ],
    primaryFeatures: [
      { title: "Adjustable compression", description: "Customize the compression level with adjustable straps." },
      { title: "Hinged lateral support", description: "Controlled lateral stability during movement." },
      { title: "Breathable support material", description: "Comfortable extended use with breathable fabric." },
      { title: "Adjustable fastening straps", description: "Easy to put on and adjust for a secure fit." },
      { title: "Customizable fit", description: "One size fits most with adjustable design." },
      { title: "Lightweight construction", description: "Minimal bulk for comfortable daily wear." },
    ],
    warranty: ["6-month manufacturer warranty against manufacturing defects."],
    packageWeight: 0.25,
    packageLength: 30,
    packageWidth: 20,
    packageHeight: 8,
    fragile: false,
    hazardous: false,
  };

  let product;
  if (!existingProduct) {
    product = await prisma.product.create({ data: productData });
    console.log(`  ✓ Created product: ${product.title} (${product.id})`);
  } else {
    product = await prisma.product.update({
      where: { id: existingProduct.id },
      data: productData,
    });
    console.log(`  ✓ Updated product: ${product.title} (${product.id})`);
  }

  // ─── Country visibility ──────────────────────────────────
  await prisma.productCountry.upsert({
    where: { productId_countryId: { productId: product.id, countryId: india.id } },
    update: { enabled: true },
    create: { productId: product.id, countryId: india.id, enabled: true },
  });
  if (usCountry) {
    await prisma.productCountry.upsert({
      where: { productId_countryId: { productId: product.id, countryId: usCountry.id } },
      update: { enabled: true },
      create: { productId: product.id, countryId: usCountry.id, enabled: true },
    });
  }
  console.log("  ✓ Country visibility set");

  // ─── Product pricing: India (INR) ────────────────────────
  const indiaPrice = await prisma.productPrice.findFirst({
    where: { productId: product.id, variantId: null, countryId: india.id },
  });
  if (indiaPrice) {
    await prisma.productPrice.update({
      where: { id: indiaPrice.id },
      data: {
        mrp: 2499, sellingPrice: 1999, dealerPrice: 1799,
        distributorPrice: 1699, taxPercentage: 18, currencyId: inr.id, status: "ACTIVE",
      },
    });
  } else {
    await prisma.productPrice.create({
      data: {
        productId: product.id, countryId: india.id, currencyId: inr.id,
        mrp: 2499, sellingPrice: 1999, dealerPrice: 1799,
        distributorPrice: 1699, taxPercentage: 18, status: "ACTIVE",
      },
    });
  }
  console.log("  ✓ India pricing set: MRP ₹2,499, Selling ₹1,999");

  // ─── GST tax rule (India domestic, INCLUSIVE, product-scoped) ──
  const existingTaxRule = await (prisma as any).taxRule.findFirst({
    where: { products: { some: { id: product.id } }, status: "ACTIVE" },
  });
  if (existingTaxRule) {
    await (prisma as any).taxRule.update({
      where: { id: existingTaxRule.id },
      data: { type: "CGST", taxMode: "INCLUSIVE", percentage: 18, countryId: india.id },
    });
  } else {
    await (prisma as any).taxRule.create({
      data: {
        name: "GST 18% India - " + product.slug,
        type: "CGST",
        taxMode: "INCLUSIVE",
        percentage: 18,
        countryId: india.id,
        status: "ACTIVE",
        countries: { create: [{ countryId: india.id }] },
        products: { connect: [{ id: product.id }] },
      },
    });
  }
  console.log("  ✓ GST tax rule set: 18% INCLUSIVE (India)");

  // ─── Product pricing: US (USD) ───────────────────────────
  if (usCountry && usd) {
    const usPrice = await prisma.productPrice.findFirst({
      where: { productId: product.id, variantId: null, countryId: usCountry.id },
    });
    if (usPrice) {
      await prisma.productPrice.update({
        where: { id: usPrice.id },
        data: {
          mrp: 39.99, sellingPrice: 32.99, dealerPrice: 28.99,
          distributorPrice: 26.99, taxPercentage: 0, currencyId: usd.id, status: "ACTIVE",
        },
      });
    } else {
      await prisma.productPrice.create({
        data: {
          productId: product.id, countryId: usCountry.id, currencyId: usd.id,
          mrp: 39.99, sellingPrice: 32.99, dealerPrice: 28.99,
          distributorPrice: 26.99, taxPercentage: 0, status: "ACTIVE",
        },
      });
    }
    console.log("  ✓ US pricing set: MRP $39.99, Selling $32.99");
  }

  // ─── Inventory ───────────────────────────────────────────
  const existingInventory = await prisma.inventory.findFirst({
    where: { productId: product.id, variantId: null, warehouseId: null },
  });
  if (existingInventory) {
    await prisma.inventory.update({
      where: { id: existingInventory.id },
      data: { stock: 50, status: "IN_STOCK" },
    });
  } else {
    await prisma.inventory.create({
      data: {
        productId: product.id,
        stock: 50,
        lowStockThreshold: 10,
        status: "IN_STOCK",
      },
    });
  }
  console.log("  ✓ Inventory set: 50 units");

  // ─── Product media (placeholder images) ──────────────────
  const existingMediaCount = await prisma.productMedia.count({
    where: { productId: product.id },
  });
  if (existingMediaCount === 0) {
    await prisma.productMedia.createMany({
      data: [
        {
          productId: product.id,
          url: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800&auto=format&fit=crop",
          altText: "ModOrtho Adjustable Hinged Knee Support - Front View",
          sortOrder: 0,
          type: "IMAGE",
          storageProvider: "LOCAL",
        },
        {
          productId: product.id,
          url: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&auto=format&fit=crop",
          altText: "ModOrtho Adjustable Hinged Knee Support - Side View",
          sortOrder: 1,
          type: "IMAGE",
          storageProvider: "LOCAL",
        },
        {
          productId: product.id,
          url: "https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=800&auto=format&fit=crop",
          altText: "ModOrtho Adjustable Hinged Knee Support - In Use",
          sortOrder: 2,
          type: "IMAGE",
          storageProvider: "LOCAL",
        },
      ],
    });
    console.log("  ✓ Product media created (3 placeholder images)");
  } else {
    console.log(`  ✓ Product media already exists (${existingMediaCount} records)`);
  }

  // ─── Payment gateways & methods ──────────────────────────
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
  await prisma.paymentGateway.upsert({
    where: { provider: "CASHFREE" },
    update: {},
    create: { provider: "CASHFREE", displayName: "Cashfree", isEnabled: false, countries: ["IN"] },
  });

  const codPayment = await prisma.paymentMethod.upsert({
    where: { code: "COD" },
    update: {
      name: "Pay on Delivery",
      description: "Pay with cash or card upon delivery",
      type: PaymentMethodType.OFFLINE,
      isEnabled: true,
      sortOrder: 1,
    },
    create: {
      code: "COD",
      name: "Pay on Delivery",
      description: "Pay with cash or card upon delivery",
      type: PaymentMethodType.OFFLINE,
      isEnabled: true,
      sortOrder: 1,
    },
  });

  const razorpayPayment = await prisma.paymentMethod.upsert({
    where: { code: "RAZORPAY" },
    update: {
      name: "Razorpay (UPI / Cards / NetBanking)",
      description: "Fast & secure online payments for Indian accounts",
      type: PaymentMethodType.SDK_MODAL,
      clientScriptUrl: "https://checkout.razorpay.com/v1/checkout.js",
      isEnabled: true,
      sortOrder: 2,
    },
    create: {
      code: "RAZORPAY",
      name: "Razorpay (UPI / Cards / NetBanking)",
      description: "Fast & secure online payments for Indian accounts",
      type: PaymentMethodType.SDK_MODAL,
      clientScriptUrl: "https://checkout.razorpay.com/v1/checkout.js",
      isEnabled: true,
      sortOrder: 2,
    },
  });

  const stripePayment = await prisma.paymentMethod.upsert({
    where: { code: "STRIPE" },
    update: {
      name: "Credit Card / Debit Card (Stripe)",
      description: "Fast & secure international card payment via Stripe",
      type: PaymentMethodType.HOSTED_REDIRECT,
      isEnabled: true,
      sortOrder: 3,
    },
    create: {
      code: "STRIPE",
      name: "Credit Card / Debit Card (Stripe)",
      description: "Fast & secure international card payment via Stripe",
      type: PaymentMethodType.HOSTED_REDIRECT,
      isEnabled: true,
      sortOrder: 3,
    },
  });

  const cashfreePayment = await prisma.paymentMethod.upsert({
    where: { code: "CASHFREE" },
    update: {
      name: "Cashfree (Cards / UPI / NetBanking)",
      description: "Fast & secure online payments powered by Cashfree",
      type: PaymentMethodType.SDK_MODAL,
      clientScriptUrl: "https://sdk.cashfree.com/js/v3/cashfree.js",
      isEnabled: true,
      sortOrder: 4,
    },
    create: {
      code: "CASHFREE",
      name: "Cashfree (Cards / UPI / NetBanking)",
      description: "Fast & secure online payments powered by Cashfree",
      type: PaymentMethodType.SDK_MODAL,
      clientScriptUrl: "https://sdk.cashfree.com/js/v3/cashfree.js",
      isEnabled: true,
      sortOrder: 4,
    },
  });

  const paymentCountries = await prisma.country.findMany();
  for (const pc of paymentCountries) {
    const pcIsIndia = pc.code.toUpperCase() === "IN";
    await prisma.paymentMethodCountry.upsert({
      where: { paymentMethodId_countryId: { paymentMethodId: codPayment.id, countryId: pc.id } },
      update: { isEnabled: true, isDefault: false },
      create: { paymentMethodId: codPayment.id, countryId: pc.id, isEnabled: true, isDefault: false },
    });
    await prisma.paymentMethodCountry.upsert({
      where: { paymentMethodId_countryId: { paymentMethodId: razorpayPayment.id, countryId: pc.id } },
      update: { isEnabled: pcIsIndia, isDefault: pcIsIndia },
      create: { paymentMethodId: razorpayPayment.id, countryId: pc.id, isEnabled: pcIsIndia, isDefault: pcIsIndia },
    });
    await prisma.paymentMethodCountry.upsert({
      where: { paymentMethodId_countryId: { paymentMethodId: stripePayment.id, countryId: pc.id } },
      update: { isEnabled: !pcIsIndia, isDefault: !pcIsIndia },
      create: { paymentMethodId: stripePayment.id, countryId: pc.id, isEnabled: !pcIsIndia, isDefault: !pcIsIndia },
    });
    await prisma.paymentMethodCountry.upsert({
      where: { paymentMethodId_countryId: { paymentMethodId: cashfreePayment.id, countryId: pc.id } },
      update: { isEnabled: pcIsIndia, isDefault: false },
      create: { paymentMethodId: cashfreePayment.id, countryId: pc.id, isEnabled: pcIsIndia, isDefault: false },
    });
  }
  console.log("  ✓ Payment methods set: COD, Razorpay (IN default), Stripe (rest of world), Cashfree (IN)");

  // ─── Shipping provider & zone (India) ────────────────────
  const dhlProvider = await prisma.shippingProvider.upsert({
    where: { name: "DHL" },
    update: { displayName: "DHL Express", baseUrl: "https://api.dhl.com/mydhlapi", trackingUrl: "https://track.dhl.com/{tracking}", isEnabled: true },
    create: { name: "DHL", displayName: "DHL Express", baseUrl: "https://api.dhl.com/mydhlapi", trackingUrl: "https://track.dhl.com/{tracking}", isEnabled: true },
  });
  await prisma.shippingProvider.upsert({
    where: { name: "DTDC" },
    update: { displayName: "DTDC Courier", baseUrl: "https://api.dtdc.in", trackingUrl: "https://www.dtdc.in/tracking/{tracking}" },
    create: { name: "DTDC", displayName: "DTDC Courier", baseUrl: "https://api.dtdc.in", trackingUrl: "https://www.dtdc.in/tracking/{tracking}", isEnabled: false },
  });
  const indiaZone = await prisma.shippingZone.findFirst({
    where: { providerId: dhlProvider.id, countries: { some: { countryId: india.id } } },
    select: { id: true },
  });
  if (indiaZone) {
    await prisma.shippingZone.update({
      where: { id: indiaZone.id },
      data: { status: "ACTIVE", charge: 0, freeAbove: 0, estimatedDays: "3-5 business days" },
    });
  } else {
    await prisma.shippingZone.create({
      data: {
        providerId: dhlProvider.id,
        charge: 0,
        freeAbove: 0,
        estimatedDays: "3-5 business days",
        status: "ACTIVE",
        countries: { create: [{ countryId: india.id }] },
      },
    });
  }
  console.log("  ✓ Shipping zone set: India (DHL, free)");

  // ─── Shipping box (India) ───────────────────────────────
  const box = await prisma.shippingBox.findFirst({
    where: { name: "Standard Box S" },
    select: { id: true },
  });
  if (box) {
    await prisma.shippingBox.update({
      where: { id: box.id },
      data: { length: 30, width: 25, height: 12, maxWeight: 2, isActive: true },
    });
    const partial = await prisma.shippingBoxCountry.findUnique({
      where: { boxId_countryId: { boxId: box.id, countryId: india.id } },
    });
    if (!partial) {
      await prisma.shippingBoxCountry.create({ data: { boxId: box.id, countryId: india.id } });
    }
  } else {
    await prisma.shippingBox.create({
      data: {
        name: "Standard Box S",
        length: 30,
        width: 25,
        height: 12,
        maxWeight: 2,
        isActive: true,
        countries: { create: [{ countryId: india.id }] },
      },
    });
  }
  console.log("  ✓ Shipping box set: Standard Box S (30x25x12cm, 2kg, India)");

  // ─── Print summary ───────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════");
  console.log("  DUMMY PRODUCT CREATED SUCCESSFULLY");
  console.log("═══════════════════════════════════════════════════");
  console.log(`  Product ID:  ${product.id}`);
  console.log(`  SKU:         ${product.sku}`);
  console.log(`  Slug:        ${product.slug}`);
  console.log(`  Category:    ${category.name}`);
  console.log(`  Status:      ${product.status}`);
  console.log(`  Price (INR): ₹1,999 (MRP ₹2,499)`);
  console.log(`  Stock:       50 units`);
  console.log("═══════════════════════════════════════════════════\n");
}

main()
  .catch((error) => {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
