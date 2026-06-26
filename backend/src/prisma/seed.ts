import { Prisma, PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s.-]/g, "")
    .replace(/[\s_.]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildVariantKey(attributeValueIds: string[], packageId?: string | null) {
  const valueKey = [...attributeValueIds].sort().join("-");
  return packageId ? `${packageId}::${valueKey}` : valueKey;
}

const ADMIN_PERMISSIONS = [
  "products.view",
  "products.manage",
  "products.create",
  "products.update",
  "products.delete",
  "categories.view",
  "categories.manage",
  "attributes.view",
  "attributes.manage",
  "collections.view",
  "collections.manage",
  "customers.view",
  "customers.manage",
  "orders.view",
  "orders.manage",
  "quotes.view",
  "quotes.manage",
  "inventory.view",
  "inventory.manage",
  "cms.view",
  "cms.manage",
  "translations.view",
  "translations.manage",
  "pricing.view",
  "pricing.manage",
  "tiers.view",
  "tiers.manage",
  "discounts.view",
  "discounts.manage",
  "coupons.view",
  "coupons.manage",
];

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
    update: { permissions: ADMIN_PERMISSIONS },
    create: {
      name: "Admin",
      permissions: ADMIN_PERMISSIONS,
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

  // Default customer pricing tiers. Country/pricing mappings are intentionally empty until admins enable them.
  await prisma.tier.upsert({
    where: { name: "Silver" },
    update: { status: "ACTIVE", sortOrder: 1 },
    create: { name: "Silver", status: "ACTIVE", sortOrder: 1 },
  });
  await prisma.tier.upsert({
    where: { name: "Gold" },
    update: { status: "ACTIVE", sortOrder: 2 },
    create: { name: "Gold", status: "ACTIVE", sortOrder: 2 },
  });
  await prisma.tier.upsert({
    where: { name: "Platinum" },
    update: { status: "ACTIVE", sortOrder: 3 },
    create: { name: "Platinum", status: "ACTIVE", sortOrder: 3 },
  });

  const molarTubeCategory = await prisma.category.upsert({
    where: { slug: "molar-tubes" },
    update: { name: "Molar Tubes", status: "ACTIVE" },
    create: { name: "Molar Tubes", slug: "molar-tubes", description: "Bondable and weldable molar tubes.", status: "ACTIVE", sortOrder: 1 },
  });

  const nitiCategory = await prisma.category.upsert({
    where: { slug: "niti-wires" },
    update: { name: "NiTi Wires", status: "ACTIVE" },
    create: { name: "NiTi Wires", slug: "niti-wires", description: "Nickel titanium archwires.", status: "ACTIVE", sortOrder: 2 },
  });

  const attributeCatalog = [
    {
      name: "Prescription",
      sortOrder: 1,
      values: [
        { value: "MBT", note: "McLaughlin Bennett Trevisi prescription", priceAdjustment: 0 },
        { value: "Roth", note: "Roth prescription", priceAdjustment: 0 },
        { value: "Alexander", note: "Alexander prescription", priceAdjustment: 12 },
      ],
    },
    {
      name: "Slot",
      sortOrder: 2,
      values: [
        { value: ".018", note: "0.018 slot", priceAdjustment: 0 },
        { value: ".022", note: "0.022 slot", priceAdjustment: 15 },
      ],
    },
    {
      name: "Hook",
      sortOrder: 3,
      values: [
        { value: "Hook 3", note: "Hook on canine", priceAdjustment: 0 },
        { value: "Hook 4", note: "Hook on first premolar", priceAdjustment: 8 },
        { value: "Hook 5", note: "Hook on second premolar", priceAdjustment: 12 },
      ],
    },
    {
      name: "Wire Size",
      sortOrder: 4,
      values: [
        { value: ".018 x .025", note: "Rectangular wire slot compatibility", priceAdjustment: 0 },
        { value: ".019 x .025", note: "Rectangular heavy wire slot compatibility", priceAdjustment: 20 },
      ],
    },
    {
      name: "Size",
      sortOrder: 5,
      values: [
        { value: ".012", note: "Initial alignment size", priceAdjustment: 0 },
        { value: ".014", note: "Intermediate alignment size", priceAdjustment: 6 },
        { value: ".016", note: "Working alignment size", priceAdjustment: 12 },
      ],
    },
    {
      name: "Arch",
      sortOrder: 6,
      values: [
        { value: "Upper", note: "Upper arch", priceAdjustment: 0 },
        { value: "Lower", note: "Lower arch", priceAdjustment: 0 },
      ],
    },
    {
      name: "Pack Size",
      sortOrder: 7,
      values: [
        { value: "Single", note: "Single patient pack", priceAdjustment: 0 },
        { value: "5 Pack", note: "Pack of five", priceAdjustment: 35 },
        { value: "10 Pack", note: "Pack of ten", priceAdjustment: 60 },
      ],
    },
  ] as const;

  const attributesByName = new Map<string, { id: string; valuesByValue: Map<string, { id: string; attributeId: string; value: string }> }>();
  const duplicateSeedAttributeNames = attributeCatalog
    .map((attribute) => attribute.name)
    .filter((name, index, names) => names.indexOf(name) !== index);
  if (duplicateSeedAttributeNames.length) {
    throw new Error(`Duplicate seeded attribute names: ${duplicateSeedAttributeNames.join(", ")}`);
  }

  for (const attributeData of attributeCatalog) {
    const existingAttributes = await prisma.attribute.findMany({
      where: { name: attributeData.name },
      orderBy: { createdAt: "asc" },
    });
    if (existingAttributes.length > 1) {
      throw new Error(`Multiple existing attributes found with name "${attributeData.name}". Resolve duplicates before seeding.`);
    }

    const attribute = existingAttributes[0]
      ? await prisma.attribute.update({
          where: { id: existingAttributes[0].id },
          data: { name: attributeData.name, sortOrder: attributeData.sortOrder, status: "ACTIVE" },
        })
      : await prisma.attribute.create({
          data: { name: attributeData.name, role: "DROPDOWN", sortOrder: attributeData.sortOrder, status: "ACTIVE" },
        });

    const valuesByValue = new Map<string, { id: string; attributeId: string; value: string }>();
    for (let i = 0; i < attributeData.values.length; i++) {
      const valueData = attributeData.values[i];
      const attributeValue = await prisma.attributeValue.upsert({
        where: { attributeId_slug: { attributeId: attribute.id, slug: slugify(valueData.value) } },
        update: {
          value: valueData.value,
          note: valueData.note,
          priceAdjustment: valueData.priceAdjustment,
          sortOrder: i,
          status: "ACTIVE",
        },
        create: {
          attributeId: attribute.id,
          value: valueData.value,
          slug: slugify(valueData.value),
          note: valueData.note,
          priceAdjustment: valueData.priceAdjustment,
          sortOrder: i,
          status: "ACTIVE",
        },
      });
      valuesByValue.set(valueData.value, { id: attributeValue.id, attributeId: attribute.id, value: attributeValue.value });
    }

    attributesByName.set(attributeData.name, { id: attribute.id, valuesByValue });
  }

  async function resetProduct(productId: string) {
    await prisma.productPrice.deleteMany({ where: { productId } });
    await prisma.inventory.deleteMany({ where: { productId } });
    await prisma.productVariantAttributeValue.deleteMany({ where: { variant: { productId } } });
    await prisma.productVariant.deleteMany({ where: { productId } });
    await prisma.productAttributeValueSelection.deleteMany({ where: { productAttribute: { productId } } });
    await prisma.productAttribute.deleteMany({ where: { productId } });
    await prisma.productPackage.deleteMany({ where: { productId } });
  }

  async function assignAllowedValues(productId: string, config: Array<{ attributeName: string; values: string[] }>) {
    for (const item of config) {
      const attribute = attributesByName.get(item.attributeName);
      if (!attribute) throw new Error(`Unknown attribute: ${item.attributeName}`);
      const assignment = await prisma.productAttribute.create({
        data: { productId, attributeId: attribute.id, required: true },
      });
      await prisma.productAttributeValueSelection.createMany({
        data: item.values.map((value) => {
          const attributeValue = attribute.valuesByValue.get(value);
          if (!attributeValue) throw new Error(`Unknown value "${value}" for attribute "${item.attributeName}"`);
          return {
            productAttributeId: assignment.id,
            attributeValueId: attributeValue.id,
          };
        }),
      });
    }
  }

  async function createVariant(params: {
    productId: string;
    packageId?: string | null;
    selections: Array<{ attributeName: string; value: string }>;
    sku: string;
    moq: number;
    basePrice: number;
    stock: number;
  }) {
    const attributeValues = params.selections.map((selection) => {
      const attribute = attributesByName.get(selection.attributeName);
      if (!attribute) throw new Error(`Unknown attribute: ${selection.attributeName}`);
      const attributeValue = attribute.valuesByValue.get(selection.value);
      if (!attributeValue) throw new Error(`Unknown value "${selection.value}" for attribute "${selection.attributeName}"`);
      return attributeValue;
    });

    const variantKey = buildVariantKey(attributeValues.map((value) => value.id), params.packageId);
    const packageRecord = params.packageId ? await prisma.productPackage.findUnique({ where: { id: params.packageId } }) : null;
    const title = [...attributeValues.map((value) => value.value), ...(packageRecord ? [packageRecord.title] : [])].join(" / ");

    const variant = await prisma.productVariant.create({
      data: {
        productId: params.productId,
        packageId: params.packageId ?? null,
        sku: params.sku,
        title,
        variantKey,
        moq: params.moq,
        status: "ACTIVE",
      },
    });

    await prisma.productVariantAttributeValue.createMany({
      data: attributeValues.map((value) => ({
        variantId: variant.id,
        attributeId: value.attributeId,
        attributeValueId: value.id,
      })),
    });

    await prisma.inventory.create({
      data: {
        productId: params.productId,
        variantId: variant.id,
        stock: params.stock,
        lowStockThreshold: 10,
      },
    });

    await prisma.productPrice.createMany({
      data: [
        {
          productId: params.productId,
          variantId: variant.id,
          countryId: (await prisma.country.findUniqueOrThrow({ where: { code: "IN" } })).id,
          currencyId: inr.id,
          mrp: params.basePrice * 1.1,
          sellingPrice: params.basePrice,
          dealerPrice: params.basePrice * 0.9,
          distributorPrice: params.basePrice * 0.85,
          taxPercentage: 18,
          status: "ACTIVE",
        },
        {
          productId: params.productId,
          variantId: variant.id,
          countryId: (await prisma.country.findUniqueOrThrow({ where: { code: "US" } })).id,
          currencyId: usd.id,
          mrp: Number((params.basePrice * 0.015).toFixed(2)) * 1.1,
          sellingPrice: Number((params.basePrice * 0.015).toFixed(2)),
          dealerPrice: Number((params.basePrice * 0.0135).toFixed(2)),
          distributorPrice: Number((params.basePrice * 0.0125).toFixed(2)),
          taxPercentage: 0,
          status: "ACTIVE",
        },
      ],
    });

    return variant;
  }

  const elfinProduct = await prisma.product.upsert({
    where: { slug: "elfin-bondable-molar-tube" },
    update: {
      title: "Elfin Bondable Molar Tube",
      shortDescription: "Bondable molar tube system with package-level commercial variants.",
      description: "Commercially packaged molar tube product with prescription, slot, hook and wire-size configuration dimensions.",
      categoryId: molarTubeCategory.id,
      sku: "ELFIN-MT",
      productCode: "MT-ELFIN-BOND",
      brand: "Modern Orthodontics",
      status: "ACTIVE",
      hasVariants: true,
      isFeatured: true,
      defaultCountryId: (await prisma.country.findUniqueOrThrow({ where: { code: "IN" } })).id,
      defaultCurrencyId: inr.id,
      seoTitle: "Elfin Bondable Molar Tube",
      seoDescription: "Package-aware molar tube catalog with sellable SKU variants.",
    },
    create: {
      title: "Elfin Bondable Molar Tube",
      slug: "elfin-bondable-molar-tube",
      shortDescription: "Bondable molar tube system with package-level commercial variants.",
      description: "Commercially packaged molar tube product with prescription, slot, hook and wire-size configuration dimensions.",
      categoryId: molarTubeCategory.id,
      sku: "ELFIN-MT",
      productCode: "MT-ELFIN-BOND",
      brand: "Modern Orthodontics",
      status: "ACTIVE",
      hasVariants: true,
      isFeatured: true,
      defaultCountryId: (await prisma.country.findUniqueOrThrow({ where: { code: "IN" } })).id,
      defaultCurrencyId: inr.id,
      seoTitle: "Elfin Bondable Molar Tube",
      seoDescription: "Package-aware molar tube catalog with sellable SKU variants.",
    },
  });

  await resetProduct(elfinProduct.id);

  const elfinFivePatient = await prisma.productPackage.create({
    data: {
      productId: elfinProduct.id,
      title: "5 Patient Set",
      slug: "5-patient-set",
      description: "Five-patient commercial set for clinic ordering.",
      sortOrder: 1,
      status: "ACTIVE",
    },
  });

  const elfinLoose = await prisma.productPackage.create({
    data: {
      productId: elfinProduct.id,
      title: "Loose Molar Tubes",
      slug: "loose-molar-tubes",
      description: "Loose tube pack for distributor replenishment.",
      sortOrder: 2,
      status: "ACTIVE",
    },
  });

  await assignAllowedValues(elfinProduct.id, [
    { attributeName: "Prescription", values: ["MBT", "Roth"] },
    { attributeName: "Slot", values: [".018", ".022"] },
    { attributeName: "Hook", values: ["Hook 3", "Hook 4"] },
    { attributeName: "Wire Size", values: [".018 x .025", ".019 x .025"] },
  ]);

  for (const pkg of [elfinFivePatient, elfinLoose]) {
    for (const prescription of ["MBT", "Roth"]) {
      for (const slot of [".018", ".022"]) {
        for (const hook of ["Hook 3", "Hook 4"]) {
          for (const wireSize of [".018 x .025", ".019 x .025"]) {
            const sku = `ELFIN-${pkg.slug === "5-patient-set" ? "5P" : "L"}-${prescription}-${slot.replace(".", "")}-${hook.replace("Hook ", "H")}-${wireSize.replace(/[ .x]/g, "")}`;
            const basePrice = pkg.id === elfinFivePatient.id ? 2450 : 540;
            await createVariant({
              productId: elfinProduct.id,
              packageId: pkg.id,
              selections: [
                { attributeName: "Prescription", value: prescription },
                { attributeName: "Slot", value: slot },
                { attributeName: "Hook", value: hook },
                { attributeName: "Wire Size", value: wireSize },
              ],
              sku,
              moq: pkg.id === elfinFivePatient.id ? 5 : 20,
              basePrice: basePrice + (slot === ".022" ? 80 : 0) + (hook === "Hook 4" ? 40 : 0),
              stock: pkg.id === elfinFivePatient.id ? 120 : 420,
            });
          }
        }
      }
    }
  }

  await prisma.productPrice.createMany({
    data: [
      {
        productId: elfinProduct.id,
        countryId: (await prisma.country.findUniqueOrThrow({ where: { code: "IN" } })).id,
        currencyId: inr.id,
        mrp: 2700,
        sellingPrice: 2450,
        dealerPrice: 2200,
        distributorPrice: 2050,
        taxPercentage: 18,
        status: "ACTIVE",
      },
      {
        productId: elfinProduct.id,
        countryId: (await prisma.country.findUniqueOrThrow({ where: { code: "US" } })).id,
        currencyId: usd.id,
        mrp: 39,
        sellingPrice: 36,
        dealerPrice: 32,
        distributorPrice: 30,
        taxPercentage: 0,
        status: "ACTIVE",
      },
    ],
  });

  const nitiProduct = await prisma.product.upsert({
    where: { slug: "niti-wire-product" },
    update: {
      title: "NiTi Wire Product",
      shortDescription: "NiTi wire program configured by size, arch and pack size.",
      description: "Nickel titanium wire product with selected size, arch and pack-size variants.",
      categoryId: nitiCategory.id,
      sku: "NITI-WIRE",
      productCode: "NITI-WIRE-01",
      brand: "Modern Orthodontics",
      status: "ACTIVE",
      hasVariants: true,
      defaultCountryId: (await prisma.country.findUniqueOrThrow({ where: { code: "IN" } })).id,
      defaultCurrencyId: inr.id,
      seoTitle: "NiTi Wire Product",
      seoDescription: "NiTi wire variant model using allowed attribute values.",
    },
    create: {
      title: "NiTi Wire Product",
      slug: "niti-wire-product",
      shortDescription: "NiTi wire program configured by size, arch and pack size.",
      description: "Nickel titanium wire product with selected size, arch and pack-size variants.",
      categoryId: nitiCategory.id,
      sku: "NITI-WIRE",
      productCode: "NITI-WIRE-01",
      brand: "Modern Orthodontics",
      status: "ACTIVE",
      hasVariants: true,
      defaultCountryId: (await prisma.country.findUniqueOrThrow({ where: { code: "IN" } })).id,
      defaultCurrencyId: inr.id,
      seoTitle: "NiTi Wire Product",
      seoDescription: "NiTi wire variant model using allowed attribute values.",
    },
  });

  await resetProduct(nitiProduct.id);

  await assignAllowedValues(nitiProduct.id, [
    { attributeName: "Size", values: [".012", ".014", ".016"] },
    { attributeName: "Arch", values: ["Upper", "Lower"] },
    { attributeName: "Pack Size", values: ["Single", "10 Pack"] },
  ]);

  for (const size of [".012", ".014", ".016"]) {
    for (const arch of ["Upper", "Lower"]) {
      for (const packSize of ["Single", "10 Pack"]) {
        await createVariant({
          productId: nitiProduct.id,
          selections: [
            { attributeName: "Size", value: size },
            { attributeName: "Arch", value: arch },
            { attributeName: "Pack Size", value: packSize },
          ],
          sku: `NITI-${size.replace(".", "")}-${arch === "Upper" ? "U" : "L"}-${packSize === "Single" ? "S" : "10"}`,
          moq: packSize === "Single" ? 10 : 2,
          basePrice: 180 + (size === ".016" ? 20 : size === ".014" ? 10 : 0) + (packSize === "10 Pack" ? 120 : 0),
          stock: 300,
        });
      }
    }
  }

  await prisma.productPrice.createMany({
    data: [
      {
        productId: nitiProduct.id,
        countryId: (await prisma.country.findUniqueOrThrow({ where: { code: "IN" } })).id,
        currencyId: inr.id,
        mrp: 240,
        sellingPrice: 210,
        dealerPrice: 190,
        distributorPrice: 175,
        taxPercentage: 18,
        status: "ACTIVE",
      },
      {
        productId: nitiProduct.id,
        countryId: (await prisma.country.findUniqueOrThrow({ where: { code: "US" } })).id,
        currencyId: usd.id,
        mrp: 4.2,
        sellingPrice: 3.8,
        dealerPrice: 3.4,
        distributorPrice: 3.1,
        taxPercentage: 0,
        status: "ACTIVE",
      },
    ],
  });

  // ─── CMS Seed ───────────────────────────────────────────
  console.log("🌱 Seeding CMS pages…");

  async function upsertPage(data: { title: string; slug: string; pageKey: string; seoTitle?: string; seoDescription?: string }) {
    return prisma.cMSPage.upsert({
      where: { pageKey: data.pageKey },
      update: { title: data.title, seoTitle: data.seoTitle, seoDescription: data.seoDescription },
      create: { ...data, status: "ACTIVE" },
    });
  }

  async function upsertSection(
    pageId: string,
    data: { sectionKey: string; title?: string; sortOrder: number; settingsJson?: Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput },
  ) {
    const existing = await prisma.cMSSection.findFirst({ where: { pageId, sectionKey: data.sectionKey } });
    if (existing) return prisma.cMSSection.update({ where: { id: existing.id }, data: { title: data.title, sortOrder: data.sortOrder } });
    return prisma.cMSSection.create({
      data: {
        pageId,
        status: "ACTIVE",
        description: null,
        subtitle: null,
        layoutType: null,
        ...data,
        settingsJson: data.settingsJson ?? Prisma.JsonNull,
      },
    });
  }

  async function clearAndAddBlocks(sectionId: string, blocks: object[]) {
    await prisma.cMSBlock.deleteMany({ where: { sectionId } });
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i] as Record<string, unknown>;
      await prisma.cMSBlock.create({
        data: {
          sectionId,
          blockType: (b.blockType as string) ?? "generic",
          title: (b.title as string) ?? null,
          subtitle: (b.subtitle as string) ?? null,
          description: (b.description as string) ?? null,
          image: (b.image as string) ?? null,
          icon: (b.icon as string) ?? null,
          linkLabel: (b.linkLabel as string) ?? null,
          linkUrl: (b.linkUrl as string) ?? null,
          sortOrder: i,
          status: "ACTIVE",
          dataJson: (b.dataJson as object) ?? null,
        },
      });
    }
  }

  // ── Homepage ─────────────────────────────────────────────
  const homePage = await upsertPage({ title: "Homepage", slug: "home", pageKey: "home", seoTitle: "Modern Orthodontics — Precision Orthodontic Products", seoDescription: "Modern Orthodontics manufactures premium orthodontic brackets, wires, and accessories. ISO 13485 certified, exporting to 42 countries." });

  const heroSection = await upsertSection(homePage.id, { sectionKey: "home.hero", title: "Hero Slider", sortOrder: 0 });
  await clearAndAddBlocks(heroSection.id, [
    { blockType: "slide", title: "Committed to precision.", dataJson: { image: "https://images.unsplash.com/photo-1738162837438-92ff852619a1?fm=jpg&q=80&w=1920&auto=format&fit=crop", kicker: "Since 1994", ctaLabel: "Shop by category", ctaHref: "/products" } },
    { blockType: "slide", title: "Every bracket. One source.", dataJson: { image: "https://images.unsplash.com/photo-1769152683420-f4eff91cb30b?fm=jpg&q=80&w=1920&auto=format&fit=crop", kicker: "In-house manufacturing", ctaLabel: "Shop by category", ctaHref: "/products" } },
    { blockType: "slide", title: "Trusted far beyond Ludhiana.", dataJson: { image: "https://images.unsplash.com/photo-1759272840712-c7e5ea852367?fm=jpg&q=80&w=1920&auto=format&fit=crop", kicker: "42 countries", ctaLabel: "Become a dealer", ctaHref: "/#dealers" } },
    { blockType: "slide", title: "Certified. Not just claimed.", dataJson: { image: "https://images.unsplash.com/photo-1758873263563-5ba4aa330799?fm=jpg&q=80&w=1920&auto=format&fit=crop", kicker: "ISO 13485:2016", ctaLabel: "View certifications", ctaHref: "/quality-certifications" } },
  ]);

  const aboutSection = await upsertSection(homePage.id, { sectionKey: "home.about", title: "About Intro", sortOrder: 1 });
  await clearAndAddBlocks(aboutSection.id, [
    { blockType: "intro", title: "Engineering precision orthodontic hardware, since 1994.", description: "Our mission is to provide high-quality orthodontic products throughout the world — on time, competitively priced, and backed by support our customers can rely on.", linkLabel: "Know more", linkUrl: "/about" },
  ]);

  const statsSection = await upsertSection(homePage.id, { sectionKey: "home.stats", title: "Stats", sortOrder: 2 });
  await clearAndAddBlocks(statsSection.id, [
    { blockType: "stat", title: "30+", subtitle: "Since 1994", description: "Years manufacturing" },
    { blockType: "stat", title: "42", subtitle: "Global Reach", description: "Countries served" },
    { blockType: "stat", title: "6", subtitle: "Direct Export", description: "Continents" },
    { blockType: "stat", title: "500+", subtitle: "Catalog Depth", description: "SKUs" },
  ]);

  const certsSection = await upsertSection(homePage.id, { sectionKey: "home.certifications", title: "Certifications", sortOrder: 3 });
  await clearAndAddBlocks(certsSection.id, [
    { blockType: "certification", title: "ISO 13485:2016", description: "Quality management system certified by Underwriters Laboratories.", icon: "BadgeCheck", linkUrl: "/quality-certifications" },
    { blockType: "certification", title: "EU CE Marked", description: "Compliant with European Medical Device Directives.", icon: "ShieldCheck", linkUrl: "/quality-certifications" },
    { blockType: "certification", title: "US FDA Registered", description: "Registered manufacturer under 21 CFR Parts 808, 812 and 820.", icon: "Stamp", linkUrl: "/quality-certifications" },
    { blockType: "certification", title: "MDSAP & India CDSCO", description: "Multi-jurisdiction audit program and Indian regulatory compliance.", icon: "Globe", linkUrl: "/quality-certifications" },
  ]);

  const ctaSection = await upsertSection(homePage.id, { sectionKey: "home.contactCta", title: "Contact CTA", sortOrder: 4 });
  await clearAndAddBlocks(ctaSection.id, [
    { blockType: "cta", title: "Get in touch", description: "Have any questions about products, pricing or becoming a dealer? Our team is ready to assist you.", linkLabel: "Contact us", linkUrl: "mailto:orders@modortho.com", image: "https://images.unsplash.com/photo-1769152683420-f4eff91cb30b?fm=jpg&q=80&w=1920&auto=format&fit=crop" },
  ]);

  // ── Other pages ──────────────────────────────────────────
  await upsertPage({ title: "About Us", slug: "about", pageKey: "about", seoTitle: "About Modern Orthodontics" });
  await upsertPage({ title: "Manufacturing", slug: "manufacturing", pageKey: "manufacturing", seoTitle: "Manufacturing — Modern Orthodontics" });
  await upsertPage({ title: "Contact", slug: "contact", pageKey: "contact", seoTitle: "Contact Us — Modern Orthodontics" });
  await upsertPage({ title: "Products", slug: "products", pageKey: "products", seoTitle: "Orthodontic Products — Modern Orthodontics" });
  await upsertPage({ title: "Quality & Certifications", slug: "quality-certifications", pageKey: "quality-certifications", seoTitle: "Certifications — Modern Orthodontics" });

  // ── Default footer ────────────────────────────────────────
  const existingFooter = await prisma.cMSFooter.findFirst();
  if (!existingFooter) {
    await prisma.cMSFooter.create({
      data: {
        title: "Modern Orthodontics",
        description: "Precision orthodontic products, manufactured in India, trusted worldwide since 1994.",
        email: "orders@modortho.com",
        socialLinksJson: { linkedin: "#", instagram: "#", twitter: "#" },
        newsletterEnabled: true,
        status: "ACTIVE",
      },
    });
  }

  // ─── Default Settings ────────────────────────────────────
  console.log("🌱 Seeding default settings…");

  const defaultSettings: Array<{ key: string; value: string; group: string; label: string; type: string; isSecret?: boolean; isEnabled?: boolean }> = [
    // General
    { key: "general.site_name", value: "Modern Orthodontics", group: "general", label: "Website Name", type: "string" },
    { key: "general.site_url", value: "https://modortho.com", group: "general", label: "Website URL", type: "string" },
    { key: "general.company_name", value: "Modern Orthodontics Pvt Ltd", group: "general", label: "Company Name", type: "string" },
    { key: "general.email", value: "orders@modortho.com", group: "general", label: "Contact Email", type: "string" },
    { key: "general.phone", value: "+91-98765-43210", group: "general", label: "Phone", type: "string" },
    { key: "general.address", value: "Ludhiana, Punjab, India", group: "general", label: "Address", type: "string" },
    { key: "general.logo", value: "", group: "general", label: "Logo URL", type: "string" },
    { key: "general.favicon", value: "", group: "general", label: "Favicon URL", type: "string" },
    { key: "general.default_language", value: "en", group: "general", label: "Default Language", type: "string" },
    { key: "general.default_currency", value: "INR", group: "general", label: "Default Currency", type: "string" },
    { key: "general.timezone", value: "Asia/Kolkata", group: "general", label: "Timezone", type: "string" },
    // SEO
    { key: "seo.default_title", value: "Modern Orthodontics — Precision Orthodontic Products", group: "seo", label: "Default Meta Title", type: "string" },
    { key: "seo.default_description", value: "Modern Orthodontics manufactures premium orthodontic brackets, wires, and accessories. ISO 13485 certified.", group: "seo", label: "Default Meta Description", type: "string" },
    { key: "seo.default_keywords", value: "", group: "seo", label: "Default Meta Keywords", type: "string" },
    { key: "seo.og_title", value: "", group: "seo", label: "OG Title", type: "string" },
    { key: "seo.og_description", value: "", group: "seo", label: "OG Description", type: "string" },
    { key: "seo.og_image", value: "", group: "seo", label: "OG Image URL", type: "string" },
    { key: "seo.twitter_image", value: "", group: "seo", label: "Twitter Card Image", type: "string" },
    { key: "seo.canonical_domain", value: "https://modortho.com", group: "seo", label: "Canonical Domain", type: "string" },
    { key: "seo.robots_txt", value: "", group: "seo", label: "robots.txt Content", type: "string" },
    { key: "seo.sitemap_include_products", value: "true", group: "seo", label: "Sitemap: Include Products", type: "boolean" },
    { key: "seo.sitemap_include_categories", value: "true", group: "seo", label: "Sitemap: Include Categories", type: "boolean" },
    { key: "seo.sitemap_include_blogs", value: "false", group: "seo", label: "Sitemap: Include Blogs", type: "boolean" },
    { key: "seo.sitemap_include_cms_pages", value: "true", group: "seo", label: "Sitemap: Include CMS Pages", type: "boolean" },
    // Analytics
    { key: "analytics.ga4_measurement_id", value: "", group: "analytics", label: "GA4 Measurement ID", type: "string", isEnabled: false },
    { key: "analytics.ga4_enabled", value: "false", group: "analytics", label: "GA4 Enabled", type: "boolean" },
    { key: "analytics.gtm_container_id", value: "", group: "analytics", label: "GTM Container ID", type: "string", isEnabled: false },
    { key: "analytics.gtm_enabled", value: "false", group: "analytics", label: "GTM Enabled", type: "boolean" },
    { key: "analytics.clarity_project_id", value: "", group: "analytics", label: "Microsoft Clarity Project ID", type: "string", isEnabled: false },
    { key: "analytics.clarity_enabled", value: "false", group: "analytics", label: "Clarity Enabled", type: "boolean" },
    { key: "analytics.hotjar_site_id", value: "", group: "analytics", label: "Hotjar Site ID", type: "string", isEnabled: false },
    { key: "analytics.hotjar_enabled", value: "false", group: "analytics", label: "Hotjar Enabled", type: "boolean" },
    { key: "analytics.hubspot_tracking_code", value: "", group: "analytics", label: "HubSpot Tracking Code", type: "string", isEnabled: false },
    { key: "analytics.hubspot_enabled", value: "false", group: "analytics", label: "HubSpot Enabled", type: "boolean" },
    // Pixels
    { key: "pixels.meta_pixel_id", value: "", group: "pixels", label: "Meta Pixel ID", type: "string", isEnabled: false },
    { key: "pixels.meta_pixel_enabled", value: "false", group: "pixels", label: "Meta Pixel Enabled", type: "boolean" },
    { key: "pixels.meta_capi_access_token", value: "", group: "pixels", label: "Meta CAPI Access Token", type: "secret", isSecret: true, isEnabled: false },
    { key: "pixels.meta_capi_test_event_code", value: "", group: "pixels", label: "Meta CAPI Test Event Code", type: "string" },
    { key: "pixels.meta_capi_enabled", value: "false", group: "pixels", label: "Meta CAPI Enabled", type: "boolean" },
    { key: "pixels.linkedin_partner_id", value: "", group: "pixels", label: "LinkedIn Partner ID", type: "string", isEnabled: false },
    { key: "pixels.linkedin_enabled", value: "false", group: "pixels", label: "LinkedIn Insight Enabled", type: "boolean" },
    { key: "pixels.twitter_pixel_id", value: "", group: "pixels", label: "Twitter Pixel ID", type: "string", isEnabled: false },
    { key: "pixels.twitter_enabled", value: "false", group: "pixels", label: "Twitter Pixel Enabled", type: "boolean" },
    { key: "pixels.pinterest_tag_id", value: "", group: "pixels", label: "Pinterest Tag ID", type: "string", isEnabled: false },
    { key: "pixels.pinterest_enabled", value: "false", group: "pixels", label: "Pinterest Tag Enabled", type: "boolean" },
    { key: "pixels.tiktok_pixel_id", value: "", group: "pixels", label: "TikTok Pixel ID", type: "string", isEnabled: false },
    { key: "pixels.tiktok_enabled", value: "false", group: "pixels", label: "TikTok Pixel Enabled", type: "boolean" },
    // Marketing
    { key: "marketing.mailchimp_api_key", value: "", group: "marketing", label: "Mailchimp API Key", type: "secret", isSecret: true, isEnabled: false },
    { key: "marketing.mailchimp_audience_id", value: "", group: "marketing", label: "Mailchimp Audience ID", type: "string" },
    { key: "marketing.mailchimp_enabled", value: "false", group: "marketing", label: "Mailchimp Enabled", type: "boolean" },
    { key: "marketing.brevo_api_key", value: "", group: "marketing", label: "Brevo API Key", type: "secret", isSecret: true, isEnabled: false },
    { key: "marketing.brevo_enabled", value: "false", group: "marketing", label: "Brevo Enabled", type: "boolean" },
    // Social
    { key: "social.facebook_url", value: "", group: "social", label: "Facebook URL", type: "string" },
    { key: "social.instagram_url", value: "", group: "social", label: "Instagram URL", type: "string" },
    { key: "social.linkedin_url", value: "", group: "social", label: "LinkedIn URL", type: "string" },
    { key: "social.youtube_url", value: "", group: "social", label: "YouTube URL", type: "string" },
    { key: "social.twitter_url", value: "", group: "social", label: "Twitter/X URL", type: "string" },
    { key: "social.pinterest_url", value: "", group: "social", label: "Pinterest URL", type: "string" },
    // Verification
    { key: "verification.google", value: "", group: "verification", label: "Google Search Console Verification", type: "string" },
    { key: "verification.bing", value: "", group: "verification", label: "Bing Webmaster Verification", type: "string" },
    { key: "verification.pinterest", value: "", group: "verification", label: "Pinterest Verification", type: "string" },
    { key: "verification.facebook_domain", value: "", group: "verification", label: "Facebook Domain Verification", type: "string" },
    { key: "verification.custom", value: "", group: "verification", label: "Custom Verification Tag (HTML)", type: "string" },
    // Scripts
    { key: "scripts.header", value: "", group: "scripts", label: "Custom Header Scripts", type: "string" },
    { key: "scripts.footer", value: "", group: "scripts", label: "Custom Footer Scripts", type: "string" },
    // Cookies
    { key: "cookies.enabled", value: "false", group: "cookies", label: "Enable Cookie Consent Banner", type: "boolean" },
    { key: "cookies.banner_title", value: "We use cookies", group: "cookies", label: "Banner Title", type: "string" },
    { key: "cookies.banner_description", value: "We use cookies to improve your experience on our site and to analyse traffic.", group: "cookies", label: "Banner Description", type: "string" },
    { key: "cookies.privacy_policy_url", value: "/privacy-policy", group: "cookies", label: "Privacy Policy URL", type: "string" },
    // WhatsApp
    { key: "whatsapp.number", value: "", group: "whatsapp", label: "WhatsApp Number (international format)", type: "string" },
    { key: "whatsapp.default_message", value: "Hello, I have a question about your products.", group: "whatsapp", label: "Default Message", type: "string" },
    { key: "whatsapp.floating_button_enabled", value: "false", group: "whatsapp", label: "Show Floating WhatsApp Button", type: "boolean" },
    // Email
    { key: "email.smtp_host", value: "", group: "email", label: "SMTP Host", type: "string" },
    { key: "email.smtp_port", value: "587", group: "email", label: "SMTP Port", type: "string" },
    { key: "email.smtp_user", value: "", group: "email", label: "SMTP Username", type: "string" },
    { key: "email.smtp_password", value: "", group: "email", label: "SMTP Password", type: "secret", isSecret: true },
    { key: "email.from_name", value: "Modern Orthodontics", group: "email", label: "From Name", type: "string" },
    { key: "email.from_email", value: "noreply@modortho.com", group: "email", label: "From Email", type: "string" },
  ];

  for (const s of defaultSettings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: {},
      create: { key: s.key, value: s.value, group: s.group, label: s.label, type: s.type, isSecret: s.isSecret ?? false, isEnabled: s.isEnabled ?? true },
    });
  }

  console.log(`✅ Seed complete.`);
  console.log(`   Admin login: admin@modortho.com / Admin@1234`);
  console.log(`   Roles created: Super Admin, Admin, Staff`);
  console.log(`   Sample products: Elfin Bondable Molar Tube, NiTi Wire Product`);
  console.log(`   CMS pages seeded: home, about, manufacturing, contact, products, quality-certifications`);
  console.log(`   Settings seeded: ${defaultSettings.length} default keys across all groups`);
}

main()
  .catch((err) => { console.error("Seed failed:", err); process.exit(1); })
  .finally(() => prisma.$disconnect());
