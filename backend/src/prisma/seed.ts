import "../config/env";
import { AttributeRole, AttributeStatus, PaymentMethodType, Prisma, PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ensureAllWorldCountriesSeeded } from "../modules/countries/countries.service";

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

type SeedMenuItem = {
  key: string;
  label: string;
  url?: string;
  parentKey?: string;
  sortOrder?: number;
  openInNewTab?: boolean;
  status?: string;
};

async function upsertCmsMenuWithItems(menu: {
  name: string;
  location: string;
  status?: string;
  items: SeedMenuItem[];
}) {
  const cmsMenu = await prisma.cMSMenu.upsert({
    where: { location: menu.location },
    update: { name: menu.name, status: menu.status ?? "ACTIVE" },
    create: { name: menu.name, location: menu.location, status: menu.status ?? "ACTIVE" },
  });

  await prisma.cMSMenuItem.deleteMany({ where: { menuId: cmsMenu.id } });

  const createdByKey = new Map<string, { id: string }>();
  for (const [index, item] of menu.items.entries()) {
    const created = await prisma.cMSMenuItem.create({
      data: {
        menuId: cmsMenu.id,
        parentId: item.parentKey ? createdByKey.get(item.parentKey)?.id ?? null : null,
        label: item.label,
        url: item.url ?? "",
        sortOrder: item.sortOrder ?? index,
        openInNewTab: item.openInNewTab ?? false,
        status: item.status ?? "ACTIVE",
      },
    });
    createdByKey.set(item.key, { id: created.id });
  }

  return cmsMenu;
}

const ADMIN_PERMISSIONS = [
  "products.view",
  "products.manage",
  "products.create",
  "products.update",
  "products.delete",
  "categories.view",
  "categories.create",
  "categories.update",
  "categories.delete",
  "collections.view",
  "collections.create",
  "collections.update",
  "collections.delete",
  "attributes.view",
  "attributes.create",
  "attributes.update",
  "attributes.delete",
  "reviews.view",
  "reviews.create",
  "reviews.update",
  "reviews.delete",
  "variants.view",
  "variants.create",
  "variants.update",
  "variants.delete",
  "inventory.view",
  "inventory.create",
  "inventory.update",
  "inventory.delete",
  "orders.view",
  "orders.create",
  "orders.update",
  "orders.delete",
  "quotes.view",
  "quotes.create",
  "quotes.update",
  "quotes.delete",
  "contactSubmissions.view",
  "contactSubmissions.create",
  "contactSubmissions.update",
  "contactSubmissions.delete",
  "shipping.view",
  "shipping.create",
  "shipping.update",
  "shipping.delete",
  "coupons.view",
  "coupons.create",
  "coupons.update",
  "coupons.delete",
  "discounts.view",
  "discounts.create",
  "discounts.update",
  "discounts.delete",
  "pricing.view",
  "pricing.create",
  "pricing.update",
  "pricing.delete",
  "tiers.view",
  "tiers.create",
  "tiers.update",
  "tiers.delete",
  "tax.view",
  "tax.create",
  "tax.update",
  "tax.delete",
  "cms.view",
  "cms.create",
  "cms.update",
  "cms.delete",
  "media.view",
  "media.create",
  "media.update",
  "media.delete",
  "translations.view",
  "translations.create",
  "translations.update",
  "translations.delete",
  "ai.view",
  "ai.create",
  "ai.update",
  "ai.delete",
  "countries.view",
  "countries.create",
  "countries.update",
  "countries.delete",
  "currencies.view",
  "currencies.create",
  "currencies.update",
  "currencies.delete",
  "customers.view",
  "customers.create",
  "customers.update",
  "customers.delete",
  "users.view",
  "users.create",
  "users.update",
  "users.delete",
  "roles.view",
  "roles.create",
  "roles.update",
  "roles.delete",
  "payments.view",
  "payments.create",
  "payments.update",
  "payments.delete",
  "settings.view",
  "settings.create",
  "settings.update",
  "settings.delete",
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

  await prisma.role.upsert({
    where: { name: "Dealer" },
    update: {},
    create: { name: "Dealer", permissions: [] },
  });

  await prisma.role.upsert({
    where: { name: "Doctor / Retailer" },
    update: {},
    create: { name: "Doctor / Retailer", permissions: [] },
  });

  // ─── Super admin user ───────────────────────────────────
  const appEnv = (process.env.APP_ENV || process.env.NODE_ENV || "development").toLowerCase();
  const isDeployedSeed = appEnv === "production" || appEnv === "staging";
  const adminEmail = process.env.SEED_ADMIN_EMAIL?.trim() || (isDeployedSeed ? "" : "admin@modortho.com");
  const adminPassword = process.env.SEED_ADMIN_PASSWORD?.trim() || (isDeployedSeed ? "" : "Admin@1234");

  if (!adminEmail) {
    throw new Error("SEED_ADMIN_EMAIL is required when seeding staging or production.");
  }
  if (!adminPassword || adminPassword.length < 12) {
    throw new Error("SEED_ADMIN_PASSWORD must be at least 12 characters when seeding staging or production.");
  }

  const password = await bcrypt.hash(adminPassword, 12);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: { name: "Super Admin", email: adminEmail, password, roleId: superAdminRole.id },
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
    update: { dutyPercentage: 18 },
    create: { name: "India", code: "IN", currencyId: inr.id, isDefault: true, dutyPercentage: 18 },
  });
  await prisma.country.upsert({ where: { code: "US" }, update: { dutyPercentage: 0 }, create: { name: "United States", code: "US", currencyId: usd.id, dutyPercentage: 0 } });
  await prisma.country.upsert({ where: { code: "GB" }, update: { dutyPercentage: 5 }, create: { name: "United Kingdom", code: "GB", currencyId: gbp.id, dutyPercentage: 5 } });
  await prisma.country.upsert({ where: { code: "DE" }, update: { dutyPercentage: 5 }, create: { name: "Germany", code: "DE", currencyId: eur.id, dutyPercentage: 5 } });
  await prisma.country.upsert({ where: { code: "AU" }, update: { dutyPercentage: 10 }, create: { name: "Australia", code: "AU", currencyId: usd.id, dutyPercentage: 10 } });
  
  await ensureAllWorldCountriesSeeded();

  // ─── Default language ────────────────────────────────────
  await prisma.language.upsert({
    where: { code: "en" },
    update: {},
    create: { name: "English", code: "en", isDefault: true },
  });

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

  const cod = await prisma.paymentMethod.upsert({
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

  const razorpay = await prisma.paymentMethod.upsert({
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

  const stripe = await prisma.paymentMethod.upsert({
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

  const allCountriesForPayment = await prisma.country.findMany();
  for (const c of allCountriesForPayment) {
    const isIndia = c.code.toUpperCase() === "IN";
    await prisma.paymentMethodCountry.upsert({
      where: { paymentMethodId_countryId: { paymentMethodId: cod.id, countryId: c.id } },
      update: { isEnabled: true, isDefault: false },
      create: { paymentMethodId: cod.id, countryId: c.id, isEnabled: true, isDefault: false },
    });
    await prisma.paymentMethodCountry.upsert({
      where: { paymentMethodId_countryId: { paymentMethodId: razorpay.id, countryId: c.id } },
      update: { isEnabled: isIndia, isDefault: isIndia },
      create: { paymentMethodId: razorpay.id, countryId: c.id, isEnabled: isIndia, isDefault: isIndia },
    });
    await prisma.paymentMethodCountry.upsert({
      where: { paymentMethodId_countryId: { paymentMethodId: stripe.id, countryId: c.id } },
      update: { isEnabled: !isIndia, isDefault: !isIndia },
      create: { paymentMethodId: stripe.id, countryId: c.id, isEnabled: !isIndia, isDefault: !isIndia },
    });
  }

  // ─── Shipping providers & zones ─────────────────────────
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

  const indiaCountry = allCountriesForPayment.find((c) => c.code.toUpperCase() === "IN");
  if (indiaCountry) {
    const existingIndiaZone = await prisma.shippingZone.findFirst({
      where: { providerId: dhlProvider.id, countries: { some: { countryId: indiaCountry.id } } },
      select: { id: true },
    });
    if (existingIndiaZone) {
      await prisma.shippingZone.update({
        where: { id: existingIndiaZone.id },
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
          countries: { create: [{ countryId: indiaCountry.id }] },
        },
      });
    }
  }

  const usCountry = allCountriesForPayment.find((c) => c.code.toUpperCase() === "US");
  if (usCountry) {
    const existingUsZone = await prisma.shippingZone.findFirst({
      where: { providerId: dhlProvider.id, countries: { some: { countryId: usCountry.id } } },
      select: { id: true },
    });
    if (existingUsZone) {
      await prisma.shippingZone.update({
        where: { id: existingUsZone.id },
        data: { status: "ACTIVE", charge: 15, freeAbove: 200, estimatedDays: "5-7 business days" },
      });
    } else {
      await prisma.shippingZone.create({
        data: {
          providerId: dhlProvider.id,
          charge: 15,
          freeAbove: 200,
          estimatedDays: "5-7 business days",
          status: "ACTIVE",
          countries: { create: [{ countryId: usCountry.id }] },
        },
      });
    }
  }

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

  // ─── Default Customer Roles ────────────────────────────────
  await prisma.customerRole.upsert({
    where: { key: "GUEST" },
    update: { name: "Guest Customer", status: "ACTIVE", sortOrder: 1 },
    create: { key: "GUEST", name: "Guest Customer", description: "Default role for guest visitors", status: "ACTIVE", sortOrder: 1 },
  });
  await prisma.customerRole.upsert({
    where: { key: "DOCTOR_RETAILER" },
    update: { name: "Doctor / Retailer", status: "ACTIVE", sortOrder: 2 },
    create: { key: "DOCTOR_RETAILER", name: "Doctor / Retailer", description: "Registered doctors and retail clinics", status: "ACTIVE", sortOrder: 2 },
  });
  await prisma.customerRole.upsert({
    where: { key: "DEALER" },
    update: { name: "Dealer / B2B Wholesale", status: "ACTIVE", sortOrder: 3 },
    create: { key: "DEALER", name: "Dealer / B2B Wholesale", description: "B2B wholesale dealers and distributors", status: "ACTIVE", sortOrder: 3 },
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

    const attributeCreatePayload: Prisma.AttributeCreateInput = {
      name: attributeData.name,
      slug: slugify(attributeData.name),
      sortOrder: attributeData.sortOrder,
      role: AttributeRole.DROPDOWN,
      status: AttributeStatus.ACTIVE,
    };

    const attributeUpdatePayload: Prisma.AttributeUpdateInput = {
      name: attributeData.name,
      slug: slugify(attributeData.name),
      sortOrder: attributeData.sortOrder,
      role: AttributeRole.DROPDOWN,
      status: AttributeStatus.ACTIVE,
    };

    const attribute = existingAttributes[0]
      ? await prisma.attribute.update({
          where: { id: existingAttributes[0].id },
          data: attributeUpdatePayload,
        })
      : await prisma.attribute.create({
          data: attributeCreatePayload,
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
      hsnCode: "9021.10",
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
      hsnCode: "9021.10",
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
      hsnCode: "9018.49",
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
      hsnCode: "9018.49",
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
      update: { title: data.title, slug: data.slug, seoTitle: data.seoTitle, seoDescription: data.seoDescription, status: "ACTIVE" },
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
  const aboutPage = await upsertPage({
    title: "About Us",
    slug: "about",
    pageKey: "about",
    seoTitle: "About Modern Orthodontics",
    seoDescription: "Modern Orthodontics has manufactured orthodontic hardware in-house since 1994.",
  });
  const aboutHeroSection = await upsertSection(aboutPage.id, { sectionKey: "about.hero", title: "About Hero", sortOrder: 0 });
  await clearAndAddBlocks(aboutHeroSection.id, [
    {
      blockType: "hero",
      title: "Engineering precision orthodontic hardware, since 1994.",
      subtitle: "About Modern Orthodontics",
      description: "Our mission is to provide high-quality orthodontic products throughout the world - on time, competitively priced, and backed by support our customers can rely on.",
      image: "https://images.unsplash.com/photo-1738162837438-92ff852619a1?fm=jpg&q=80&w=1600&auto=format&fit=crop",
      dataJson: {
        subnav: [
          { label: "Our Mission", anchor: "mission" },
          { label: "What We Manufacture", anchor: "manufacture" },
          { label: "What Makes Us Different", anchor: "different" },
          { label: "FAQs", anchor: "faqs" },
        ],
      },
    },
  ]);
  const aboutMissionSection = await upsertSection(aboutPage.id, { sectionKey: "about.mission", title: "Our Mission", sortOrder: 1 });
  await clearAndAddBlocks(aboutMissionSection.id, [
    {
      blockType: "rich_text",
      title: "Our mission",
      description: "Our mission is to provide high quality orthodontic products throughout the world, on time, competitively priced and with unparalleled customer support. In doing so, we continue to forge new relationships within our growing customer base and distribution network, while building our reputation as a trusted source of quality orthodontic design, production and manufacturing.",
    },
    {
      blockType: "rich_text",
      title: "Built around in-house manufacturing",
      description: "We are manufacturers. Modern Orthodontics is a leading manufacturer of high quality, competitively priced orthodontic products. Founded in 1994, we have been doing OEM work for many orthodontic companies, and we remain one of the very few companies in the industry with in-house manufacturing across the complete range of products below.",
    },
  ]);
  const aboutManufacturingSection = await upsertSection(aboutPage.id, { sectionKey: "about.manufacture", title: "What We Manufacture", sortOrder: 2 });
  await clearAndAddBlocks(aboutManufacturingSection.id, [
    { blockType: "capability", title: "Brackets", description: "Aesthetic and metal bracket systems, designed and produced end-to-end at our Ludhiana facility.", icon: "Pyramid" },
    { blockType: "capability", title: "Molar Bands", description: "Plain and pre-welded molar bands manufactured to a consistent fit and finish.", icon: "CircleDot" },
    { blockType: "capability", title: "Molar Tubes", description: "Bondable and weldable molar tubes built for reliable anchorage.", icon: "Disc" },
    { blockType: "capability", title: "NiTi Wires & Springs", description: "Including three force-level wires, drawn and heat-treated in-house.", icon: "Waves" },
    { blockType: "capability", title: "SS & TMA Wires", description: "Stainless steel and titanium-molybdenum alloy wires across the clinical range.", icon: "Spline" },
    { blockType: "capability", title: "Coated & Pre-Torqued Wires", description: "Tooth-coloured and pre-torqued archwire options for aesthetic cases.", icon: "Link2" },
  ]);
  const aboutDifferentSection = await upsertSection(aboutPage.id, { sectionKey: "about.different", title: "What Makes Us Different", sortOrder: 3 });
  await clearAndAddBlocks(aboutDifferentSection.id, [
    {
      blockType: "intro",
      title: "What makes us different",
      description: "We use a powerful blend of the latest design software, ultra-modern manufacturing equipment and precise engineering techniques. It positions Modern Orthodontics apart from the competition as a true innovator in the design and manufacture of orthodontic products - committed to developing products for the real benefit of the science of orthodontics and the orthodontic community as a whole.",
    },
    { blockType: "capability", title: "Design Software", description: "Modern CAD and engineering tools used from the earliest stage of every new product.", icon: "PenTool" },
    { blockType: "capability", title: "Manufacturing Equipment", description: "Ultra-modern machinery across brackets, wires, bands and tubes - all on one site.", icon: "Factory" },
    { blockType: "capability", title: "Engineering Precision", description: "Tight tolerances held consistently across every batch we ship.", icon: "Compass" },
  ]);
  const aboutFaqSection = await upsertSection(aboutPage.id, { sectionKey: "about.faqs", title: "FAQs", sortOrder: 4 });
  await clearAndAddBlocks(aboutFaqSection.id, [
    { blockType: "faq", title: "How long has Modern Orthodontics been manufacturing?", description: "Since 1994 - over 30 years of in-house orthodontic manufacturing at our Ludhiana, India facility." },
    { blockType: "faq", title: "Do you manufacture everything in-house, or outsource parts?", description: "In-house. We're one of the few orthodontic companies with complete in-house manufacturing of brackets, molar tubes, molar bands, NiTi wires and springs, SS and TMA wires, and coated and pre-torqued wires." },
    { blockType: "faq", title: "Does Modern Orthodontics offer OEM or private-label manufacturing?", description: "Yes. We've done OEM work for many orthodontic companies for years, alongside our own product range." },
    { blockType: "faq", title: "Where is Modern Orthodontics based, and where do you ship?", description: "We're based in Ludhiana, Punjab, India, and supply orthodontists and dealers directly in 42 countries across six continents." },
    { blockType: "faq", title: "How can I get a product catalogue or place a bulk order?", description: "Email us at orders@modortho.com - for India, you can also call 1800 890 8022." },
  ]);
  await upsertPage({ title: "Manufacturing", slug: "manufacturing", pageKey: "manufacturing", seoTitle: "Manufacturing — Modern Orthodontics" });
  await upsertPage({ title: "Contact", slug: "contact", pageKey: "contact", seoTitle: "Contact Us — Modern Orthodontics" });
  await upsertPage({ title: "Products", slug: "products", pageKey: "products", seoTitle: "Orthodontic Products — Modern Orthodontics" });
  await upsertPage({ title: "Quality & Certifications", slug: "quality-certifications", pageKey: "quality-certifications", seoTitle: "Certifications — Modern Orthodontics" });

  // ── Default footer ────────────────────────────────────────
  const manufacturingPage = await upsertPage({
    title: "Manufacturing Services",
    slug: "manufacturing-services",
    pageKey: "manufacturing",
    seoTitle: "Manufacturing Services - Modern Orthodontics",
    seoDescription: "In-house orthodontic manufacturing capabilities spanning brackets, wires, bands, tubes, and OEM production.",
  });
  const manufacturingHeroSection = await upsertSection(manufacturingPage.id, { sectionKey: "manufacturing.hero", title: "Manufacturing Hero", sortOrder: 0 });
  await clearAndAddBlocks(manufacturingHeroSection.id, [
    {
      blockType: "hero",
      title: "Manufacturing services built for OEM partners.",
      subtitle: "Manufacturing Services",
      description: "Modern Orthodontics combines design, tooling, and production under one roof so partners can launch dependable orthodontic products faster.",
      image: "https://images.unsplash.com/photo-1738162837438-92ff852619a1?fm=jpg&q=80&w=1600&auto=format&fit=crop",
    },
  ]);
  const manufacturingTeaserSection = await upsertSection(manufacturingPage.id, { sectionKey: "manufacturing.teaser", title: "Manufacturing Teaser", sortOrder: 1 });
  await clearAndAddBlocks(manufacturingTeaserSection.id, [
    {
      blockType: "intro",
      title: "Designed for orthodontic brands that need reliability at scale.",
      description: "Our Ludhiana facility supports concept development, process control, and export-ready production for long-term distribution partners.",
    },
  ]);
  const manufacturingExpertiseSection = await upsertSection(manufacturingPage.id, { sectionKey: "manufacturing.expertise", title: "Expertise", sortOrder: 2 });
  await clearAndAddBlocks(manufacturingExpertiseSection.id, [
    { blockType: "capability", title: "Brackets & Tubes", description: "Precision-made bracket systems and bondable or weldable tubes produced in-house.", icon: "Pyramid" },
    { blockType: "capability", title: "Bands & Attachments", description: "Molar bands and auxiliaries manufactured with tight quality control for daily clinical use.", icon: "CircleDot" },
    { blockType: "capability", title: "Archwires & Springs", description: "NiTi, stainless steel, TMA, coated, and specialty wire programs produced for global partners.", icon: "Waves" },
  ]);
  const manufacturingMimSection = await upsertSection(manufacturingPage.id, { sectionKey: "manufacturing.mim", title: "MIM Capability", sortOrder: 3 });
  await clearAndAddBlocks(manufacturingMimSection.id, [
    {
      blockType: "rich_text",
      title: "Metal injection moulding capability",
      description: "We use modern tooling and process engineering to produce complex orthodontic components with repeatable precision and surface quality.",
    },
  ]);
  const manufacturingBenefitsSection = await upsertSection(manufacturingPage.id, { sectionKey: "manufacturing.benefits", title: "Benefits", sortOrder: 4 });
  await clearAndAddBlocks(manufacturingBenefitsSection.id, [
    { blockType: "benefit", title: "Single-source production", description: "Fewer handoffs and more consistent output because design and manufacturing stay aligned." },
    { blockType: "benefit", title: "OEM-ready workflows", description: "Established processes for private-label manufacturing, compliance, and export documentation." },
    { blockType: "benefit", title: "Quality-first systems", description: "ISO-certified quality controls built into every stage of production." },
  ]);
  const manufacturingProcessSection = await upsertSection(manufacturingPage.id, { sectionKey: "manufacturing.process", title: "Process", sortOrder: 5 });
  await clearAndAddBlocks(manufacturingProcessSection.id, [
    { blockType: "step", title: "Design Review", description: "We align on product specs, materials, tolerances, and packaging requirements." },
    { blockType: "step", title: "Tooling & Validation", description: "Samples are validated for fit, finish, and production repeatability before scale-up." },
    { blockType: "step", title: "Controlled Production", description: "Manufacturing runs under documented quality checks and export-ready traceability." },
  ]);
  const manufacturingNitiSection = await upsertSection(manufacturingPage.id, { sectionKey: "manufacturing.niti", title: "NiTi Specialization", sortOrder: 6 });
  await clearAndAddBlocks(manufacturingNitiSection.id, [
    {
      blockType: "rich_text",
      title: "NiTi wire specialization",
      description: "Our wire programs include multiple force levels and configurations developed for consistency in performance and finish.",
    },
  ]);
  const manufacturingFaqSection = await upsertSection(manufacturingPage.id, { sectionKey: "manufacturing.faqs", title: "FAQs", sortOrder: 7 });
  await clearAndAddBlocks(manufacturingFaqSection.id, [
    { blockType: "faq", title: "Do you support OEM manufacturing?", description: "Yes. OEM and private-label manufacturing are a core part of our long-standing business." },
    { blockType: "faq", title: "Where are the products manufactured?", description: "Production is handled from our in-house facility in Ludhiana, Punjab, India." },
    { blockType: "faq", title: "Can you handle recurring export volumes?", description: "Yes. Our systems are built to support repeatable production and international supply programs." },
  ]);

  const contactPage = await upsertPage({
    title: "Contact",
    slug: "contact",
    pageKey: "contact",
    seoTitle: "Contact Us - Modern Orthodontics",
    seoDescription: "Contact Modern Orthodontics for product enquiries, dealership requests, and export support.",
  });
  const contactHeroSection = await upsertSection(contactPage.id, { sectionKey: "contact.hero", title: "Contact Hero", sortOrder: 0 });
  await clearAndAddBlocks(contactHeroSection.id, [
    {
      blockType: "hero",
      title: "Get in touch with our team",
      subtitle: "Contact",
      description: "Whether you need product details, pricing support, or dealership guidance, we'll route you to the right team quickly.",
    },
  ]);
  const contactFormsSection = await upsertSection(contactPage.id, { sectionKey: "contact.forms", title: "Contact Forms", sortOrder: 1 });
  await clearAndAddBlocks(contactFormsSection.id, [
    { blockType: "form", title: "General Enquiry", description: "For product questions, quote requests, and support.", dataJson: { formType: "general", ctaLabel: "Submit enquiry" } },
    { blockType: "form", title: "Dealer Registration", description: "For partners interested in becoming an authorised dealer.", dataJson: { formType: "dealer", ctaLabel: "Apply now" } },
  ]);
  const contactOfficesSection = await upsertSection(contactPage.id, { sectionKey: "contact.offices", title: "Office Details", sortOrder: 2 });
  await clearAndAddBlocks(contactOfficesSection.id, [
    {
      blockType: "office",
      title: "Corporate Office",
      description: "Modern Orthodontics Pvt. Ltd., Ludhiana, Punjab, India",
      dataJson: { email: "orders@modortho.com", phone: "1800 890 8022" },
    },
    {
      blockType: "office",
      title: "Export Support",
      description: "Support for international distributors, OEM programs, and regulatory documentation.",
      dataJson: { email: "exports@modortho.com", phone: "+91-161-000-0000" },
    },
  ]);

  const productsPage = await upsertPage({
    title: "Products",
    slug: "products",
    pageKey: "products",
    seoTitle: "Orthodontic Products - Modern Orthodontics",
    seoDescription: "Explore brackets, wires, tubes, bands, and accessories manufactured by Modern Orthodontics.",
  });
  const productsHeroSection = await upsertSection(productsPage.id, { sectionKey: "products.hero", title: "Products Hero", sortOrder: 0 });
  await clearAndAddBlocks(productsHeroSection.id, [
    {
      blockType: "hero",
      title: "Orthodontic products manufactured in-house.",
      subtitle: "Products",
      description: "Browse product families built for orthodontists, dealers, and OEM distribution partners across global markets.",
    },
  ]);
  const productsHighlightsSection = await upsertSection(productsPage.id, { sectionKey: "products.highlights", title: "Highlights", sortOrder: 1 });
  await clearAndAddBlocks(productsHighlightsSection.id, [
    { blockType: "category", title: "Bracket Systems", description: "Metal and aesthetic options developed for precision and consistency.", linkUrl: "/products" },
    { blockType: "category", title: "Archwires", description: "NiTi, stainless steel, TMA, coated, and specialty wire programs.", linkUrl: "/products" },
    { blockType: "category", title: "Bands, Tubes & Accessories", description: "Complementary products for complete case support and sourcing simplicity.", linkUrl: "/products" },
  ]);
  const productsSupportSection = await upsertSection(productsPage.id, { sectionKey: "products.support", title: "Support CTA", sortOrder: 2 });
  await clearAndAddBlocks(productsSupportSection.id, [
    {
      blockType: "cta",
      title: "Need help choosing the right product range?",
      description: "Our team can recommend suitable categories based on your market, requirements, and order profile.",
      linkLabel: "Contact sales",
      linkUrl: "/contact",
    },
  ]);

  const qualityPage = await upsertPage({
    title: "Quality & Certifications",
    slug: "quality-certifications",
    pageKey: "quality-certifications",
    seoTitle: "Quality Certifications — Modern Orthodontics",
    seoDescription: "ISO 13485:2016, CE marking, FDA registration and Material Safety Data Sheets for Modern Orthodontics products.",
  });
  const qualityHeroSection = await upsertSection(qualityPage.id, { sectionKey: "quality.hero", title: "Quality Hero", sortOrder: 0 });
  await clearAndAddBlocks(qualityHeroSection.id, [
    {
      blockType: "hero",
      title: "Certified to the standards global orthodontic brands require.",
      subtitle: "Quality Certifications",
      description: "We aim to deliver a best-in-class experience — high-quality orthodontic appliances, on time, without defects and competitively priced — backed by a quality management system our team maintains and improves continuously.",
      image: "https://images.unsplash.com/photo-1758873263563-5ba4aa330799?fm=jpg&q=80&w=1600&auto=format&fit=crop",
      dataJson: {
        subnav: [
          { label: "Quality Management", anchor: "management" },
          { label: "Our Certifications", anchor: "certifications" },
          { label: "Product Label Symbols", anchor: "symbols" },
          { label: "FAQs", anchor: "faqs" },
        ],
      },
    },
  ]);
  const qualityManagementSection = await upsertSection(qualityPage.id, { sectionKey: "quality.management", title: "Quality Management", sortOrder: 1 });
  await clearAndAddBlocks(qualityManagementSection.id, [
    {
      blockType: "rich_text",
      title: "Quality management system",
      description: "Our dedicated team of professionals is trained to maintain and continually improve the effectiveness of our quality management system, while ensuring compliance with applicable standards, regulatory requirements and customer requirements. That gives our customer base the confidence that they'll receive consistently high-quality products, with individual needs and expectations met.",
    },
    {
      blockType: "rich_text",
      title: null,
      description: "MO's quality management system is certified by Underwriters Laboratories (UL) to ISO 13485:2016. ISO standards make the development, manufacturing and supply of products more efficient, safer and cleaner, ease trade between countries, and help safeguard consumers and users of medical devices everywhere.",
    },
  ]);
  const qualityCertificationsSection = await upsertSection(qualityPage.id, { sectionKey: "quality.certifications", title: "Certifications", sortOrder: 2 });
  await clearAndAddBlocks(qualityCertificationsSection.id, [
    {
      blockType: "certification",
      title: "ISO 13485:2016",
      description: "The international standard recognised for medical device quality management systems, compatible with FDA QSR and a base for EU CE marking.",
      icon: "BadgeCheck",
      linkLabel: "View certificate",
      linkUrl: "https://www.modortho.com/public/img/iso-13485-latest.pdf",
    },
    {
      blockType: "certification",
      title: "CE Mark",
      description: "The official marking required across EU member countries, confirming our products meet essential European safety and environmental requirements.",
      icon: "ShieldCheck",
      linkLabel: "View certificate",
      linkUrl: "https://www.modortho.com/public/img/ce-certificate-latest.pdf",
    },
    {
      blockType: "certification",
      title: "US FDA Registered",
      description: "Compliant with FDA quality system regulation 21 CFR Parts 808, 812 and 820 (cGMP). Modern Orthodontics is registered with the FDA as a manufacturer.",
      icon: "Stamp",
      linkLabel: "View FDA registration",
      linkUrl: "https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfRL/rl.cfm?rid=73615",
    },
    {
      blockType: "certification",
      title: "Material Safety Data Sheets",
      description: "Full chemical identity and hazard information for every relevant material, in line with OSHA's Hazard Communication Standard.",
      icon: "FlaskConical",
      linkLabel: "View MSDS",
      linkUrl: "https://www.modortho.com/material-safety-sheets",
    },
  ]);
  const qualitySymbolsSection = await upsertSection(qualityPage.id, { sectionKey: "quality.symbols", title: "Product Label Symbols", sortOrder: 3 });
  await clearAndAddBlocks(qualitySymbolsSection.id, [
    {
      blockType: "intro",
      title: "Product label symbols",
      description: "A quick reference for the most common symbols you'll find on Modern Orthodontics product labels and packaging.",
    },
    { blockType: "symbol", title: "Catalog Number", description: "Precedes the part number of the product.", icon: "Hash" },
    { blockType: "symbol", title: "LOT / Batch Code", description: "Precedes the lot number — used by MO for part traceability.", icon: "Layers" },
    { blockType: "symbol", title: "Manufacturer", description: "Identifies the manufacturer, may include the date of manufacture (YYYY-MM).", icon: "Factory" },
    { blockType: "symbol", title: "Do Not Reuse", description: "Devices marked with this symbol are intended for single use only.", icon: "Ban" },
    { blockType: "symbol", title: "Use By", description: "The part should be used before the date next to this symbol (YYYY-MM).", icon: "Hourglass" },
    { blockType: "symbol", title: "Consult Instructions for Use", description: "For products that include additional instructions inside the package.", icon: "BookOpen" },
    { blockType: "symbol", title: "Keep Away From Sunlight", description: "Used on elastics — performance may reduce with sunlight exposure.", icon: "Sun" },
    { blockType: "symbol", title: "Nickel / Chromium Warning", description: "Flags the potential for allergic reactions to these known allergens.", icon: "TriangleAlert" },
    { blockType: "symbol", title: "Rx Only", description: "For use or distribution by orthodontic professionals only.", icon: "Stethoscope" },
  ]);
  const qualityFaqSection = await upsertSection(qualityPage.id, { sectionKey: "quality.faqs", title: "FAQs", sortOrder: 4 });
  await clearAndAddBlocks(qualityFaqSection.id, [
    { blockType: "faq", title: "Is Modern Orthodontics ISO certified?", description: "Yes — our quality management system is certified to ISO 13485:2016 by Underwriters Laboratories (UL)." },
    { blockType: "faq", title: "Are your products CE marked for the European market?", description: "Yes, our quality management has been certified to CE by UL, confirming compliance with European Medical Device Directives." },
    { blockType: "faq", title: "Is Modern Orthodontics FDA registered?", description: "Yes, we're registered with the FDA as a manufacturer and compliant with 21 CFR Parts 808, 812 and 820 (cGMP)." },
    { blockType: "faq", title: "Where can I get your Material Safety Data Sheets?", description: "You can view them directly via the MSDS link above, or email orders@modortho.com for a specific sheet." },
    { blockType: "faq", title: "How do I read the symbols on a product label?", description: "See the Product Label Symbols reference above for the most common marks — catalogue number, lot code, use-by date and more." },
  ]);

  // ── Design & Engineering Page ──────────────────────────────
  const designPage = await upsertPage({
    title: "Design & Engineering",
    slug: "design-and-engineering",
    pageKey: "design-and-engineering",
    seoTitle: "Design & Engineering — Modern Orthodontics",
    seoDescription: "In-house product design, CAD modelling and tooling capabilities behind every Modern Orthodontics product.",
  });
  const designHeroSection = await upsertSection(designPage.id, { sectionKey: "design.hero", title: "Design Hero", sortOrder: 0 });
  await clearAndAddBlocks(designHeroSection.id, [
    {
      blockType: "hero",
      title: "A complete in-house design and engineering team.",
      subtitle: "Capabilities",
      description: "Direct supervision over product quality and functionality starts at the design stage. Our team brings over 20 years of collective orthodontic design experience across multiple 3D modelling platforms, working under the guidance of our founder, an orthodontist with more than two decades of clinical practice.",
      image: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?fm=jpg&q=80&w=1600&auto=format&fit=crop",
    },
  ]);
  const designToolingSection = await upsertSection(designPage.id, { sectionKey: "design.tooling", title: "In-House Tooling", sortOrder: 1 });
  await clearAndAddBlocks(designToolingSection.id, [
    {
      blockType: "rich_text",
      title: "In-house tooling, start to finish",
      description: "Design and engineering is the foundation every later manufacturing step builds on. Our tool room is equipped to design and manufacture our own molds and sheet metal tools using multiple CAD platforms, so we never depend on outside vendors for mold design or tooling.",
    },
    {
      blockType: "rich_text",
      title: null,
      description: "That in-house control is what lets a product move from paper to market quickly and at a competitive price, without losing precision along the way.",
    },
  ]);
  const designCadSection = await upsertSection(designPage.id, { sectionKey: "design.cad", title: "CAD & Mold Design", sortOrder: 2 });
  await clearAndAddBlocks(designCadSection.id, [
    {
      blockType: "intro",
      title: "What modern CAD catches before a tool is cut",
      description: "Current-generation 3D modelling software does more than draw a part — draft analysis, wall-thickness checks, undercut detection, geometry verification and parting-line recognition all happen before any metal is machined. The same software can flag sink marks, knit lines and other cosmetic defects in advance, which saves both time and tooling cost.",
    },
    { blockType: "capability", title: "Draft & Thickness Analysis", description: "Wall thickness and draft angles checked before a mold is ever cut.", icon: "Ruler" },
    { blockType: "capability", title: "Undercut Detection", description: "Geometry and parting-line issues caught at the design stage, not during a failed first run.", icon: "ScanSearch" },
    { blockType: "capability", title: "Moldability Forecasting", description: "Sink marks, knit lines and cosmetic defects predicted and designed around in advance.", icon: "Gauge" },
  ]);
  const designWhySection = await upsertSection(designPage.id, { sectionKey: "design.why", title: "Why This Shortens Lead Time", sortOrder: 3 });
  await clearAndAddBlocks(designWhySection.id, [
    {
      blockType: "rich_text",
      title: "Why this shortens your lead time",
      description: "The mold design stage is usually the most time-consuming and costly part of bringing a plastic or metal-injection-molded part to production. By forecasting problems and confirming moldability upfront, revisions happen on screen instead of on a finished tool — which is a large part of why our lead times run shorter than most of the industry.",
    },
  ]);
  const designFaqSection = await upsertSection(designPage.id, { sectionKey: "design.faqs", title: "FAQs", sortOrder: 4 });
  await clearAndAddBlocks(designFaqSection.id, [
    { blockType: "faq", title: "Does Modern Orthodontics design tools and molds in-house, or outsource them?", description: "Fully in-house. Our tool room designs and manufactures its own molds and sheet metal tools using multiple CAD platforms, so we don't depend on outside vendors for tooling." },
    { blockType: "faq", title: "Who leads the design team?", description: "The design team works under the direct guidance of our founder, an orthodontist with more than two decades of clinical practice, alongside a design team with 20+ years of combined orthodontic design experience." },
    { blockType: "faq", title: "How does CAD software reduce project risk before tooling starts?", description: "Modern 3D modelling tools check draft angles, wall thickness, undercuts and parting lines, and can forecast tooling problems like sink marks before a mold is cut — catching issues on screen instead of on a finished tool." },
    { blockType: "faq", title: "Can your design team work from our own product concept?", description: "Yes — we offer concurrent engineering and design assistance from the earliest stage, which is part of why our lead times are among the shortest in the industry." },
  ]);

  // ── OEM Services Page ──────────────────────────────────────
  const oemPage = await upsertPage({
    title: "OEM Services",
    slug: "oem-services",
    pageKey: "oem-services",
    seoTitle: "OEM Services — Modern Orthodontics",
    seoDescription: "OEM manufacturing, assembly, inspection, custom labelling and packaging for orthodontic industry partners worldwide.",
  });
  const oemHeroSection = await upsertSection(oemPage.id, { sectionKey: "oem.hero", title: "OEM Hero", sortOrder: 0 });
  await clearAndAddBlocks(oemHeroSection.id, [
    {
      blockType: "hero",
      title: "A preferred OEM partner for orthodontic brands worldwide.",
      subtitle: "Capabilities",
      description: "We've built our OEM business on the same things our own product line is judged on: product quality, end-to-end production control, and the ability to customise to a partner's exact specification — backed by an in-house tooling facility that keeps every step under one roof.",
      image: "https://images.unsplash.com/photo-1581093588401-fbb62a02f120?fm=jpg&q=80&w=1600&auto=format&fit=crop",
    },
  ]);
  const oemOfferSection = await upsertSection(oemPage.id, { sectionKey: "oem.offer", title: "What Our OEM Service Covers", sortOrder: 1 });
  await clearAndAddBlocks(oemOfferSection.id, [
    {
      blockType: "rich_text",
      title: "What our OEM service covers",
      description: "Our OEM work specialises in high-volume, labour-intensive operations: assembly line production, inspection, final packaging, custom labelling and shipping, all under the same roof as our own tooling facility. That single-site setup is what lets us hold consistent quality across every product we manufacture, for our own catalogue and for partner brands alike.",
    },
    {
      blockType: "rich_text",
      title: null,
      description: "Orthodontist feedback from across the more than 40 countries we ship to has shaped that production discipline over time, and our R&D team continues working to shorten turnaround on every new OEM project.",
    },
  ]);
  const oemWhySection = await upsertSection(oemPage.id, { sectionKey: "oem.why", title: "Why Partner With Us", sortOrder: 2 });
  await clearAndAddBlocks(oemWhySection.id, [
    { blockType: "capability", title: "Production Flexibility", description: "Direct input into production design rather than a fixed catalogue of options.", icon: "SlidersHorizontal" },
    { blockType: "capability", title: "Direct Access to Leadership", description: "Communication with senior management, not layers of account management.", icon: "Users" },
    { blockType: "capability", title: "Real-Time Schedule Visibility", description: "Live updates on where your production run actually stands.", icon: "Clock" },
    { blockType: "capability", title: "Packaging Freedom", description: "Custom labelling and packaging built around your brand, not ours.", icon: "PackageOpen" },
  ]);
  const oemBenefitsSection = await upsertSection(oemPage.id, { sectionKey: "oem.benefits", title: "The Cost Case for Partnering", sortOrder: 3 });
  await clearAndAddBlocks(oemBenefitsSection.id, [
    {
      blockType: "intro",
      title: "The cost case for partnering with us",
      description: "Beyond product quality, OEM partners typically see savings across several parts of their operation at once:",
    },
    { blockType: "capability", title: "Lower In-House Overhead", description: "Reduced or eliminated need for your own assembly and packaging staff.", icon: "Building2" },
    { blockType: "capability", title: "Lower Warehousing Cost", description: "Less inventory sitting in your own facility waiting to be assembled.", icon: "Warehouse" },
    { blockType: "capability", title: "Lower Transport Cost", description: "Fewer shipping legs between raw material, assembly and final delivery.", icon: "Truck" },
    { blockType: "capability", title: "Centralised Control", description: "One manufacturing location accountable for the full production run.", icon: "ClipboardCheck" },
  ]);
  const oemFaqSection = await upsertSection(oemPage.id, { sectionKey: "oem.faqs", title: "FAQs", sortOrder: 4 });
  await clearAndAddBlocks(oemFaqSection.id, [
    { blockType: "faq", title: "How long has Modern Orthodontics worked as an OEM manufacturer?", description: "Over 20 years, alongside our own product line, specialising in high-volume orthodontic hardware production." },
    { blockType: "faq", title: "Can OEM partners customise packaging and labelling?", description: "Yes — custom labelling, packaging and assembly are part of the core OEM service, not an add-on." },
    { blockType: "faq", title: "Will I have a single point of contact for an OEM project?", description: "Partnering with us means direct communication with senior management and real-time visibility into your production schedule, rather than working through multiple account layers." },
    { blockType: "faq", title: "What cost savings can an OEM partner expect?", description: "Most partners see reduced in-house assembly and warehouse staffing needs, lower transport costs from centralised production, and tighter inventory control overall." },
  ]);

  // ── Custom Packaging Page ──────────────────────────────────
  const packagingPage = await upsertPage({
    title: "Custom Packaging",
    slug: "custom-packaging",
    pageKey: "custom-packaging",
    seoTitle: "Custom Packaging — Modern Orthodontics",
    seoDescription: "Full and partial product assembly, welding, finishing, laser etching and custom packaging services.",
  });
  const packagingHeroSection = await upsertSection(packagingPage.id, { sectionKey: "packaging.hero", title: "Packaging Hero", sortOrder: 0 });
  await clearAndAddBlocks(packagingHeroSection.id, [
    {
      blockType: "hero",
      title: "A full-service assembly and packaging facility.",
      subtitle: "Capabilities",
      description: "From raw material coordination through final packaging and shipping, we run complete and partial product assembly under one roof — built for high-volume, labour-intensive work with assured on-time delivery.",
      image: "https://images.unsplash.com/photo-1565793298595-6a879b1d9492?fm=jpg&q=80&w=1600&auto=format&fit=crop",
    },
  ]);
  const packagingHandleSection = await upsertSection(packagingPage.id, { sectionKey: "packaging.handle", title: "What We Handle", sortOrder: 1 });
  await clearAndAddBlocks(packagingHandleSection.id, [
    {
      blockType: "rich_text",
      title: "What we handle",
      description: "Our packaging and assembly capability covers raw material coordination, inventory management, assembly line production, inspection, final packaging and shipping — combining modern equipment with staff attention to detail to keep both cost and turnaround predictable.",
    },
  ]);
  const packagingFinishingSection = await upsertSection(packagingPage.id, { sectionKey: "packaging.finishing", title: "Assembly & Finishing Services", sortOrder: 2 });
  await clearAndAddBlocks(packagingFinishingSection.id, [
    { blockType: "capability", title: "Tack & Custom Welding", description: "Precision welding for component assembly, including custom configurations.", icon: "Flame" },
    { blockType: "capability", title: "Brazing", description: "Joining processes for components that need a stronger bond than welding alone.", icon: "Beaker" },
    { blockType: "capability", title: "Color Coding", description: "Visual identification systems applied across product lines.", icon: "Palette" },
    { blockType: "capability", title: "Finishing", description: "Surface finishing for a consistent final appearance.", icon: "Sparkles" },
    { blockType: "capability", title: "Laser Etching & Engraving", description: "Permanent marking for traceability and branding.", icon: "Zap" },
    { blockType: "capability", title: "Inspection, Sorting & Rework", description: "Detailed process analysis to catch and correct non-conforming parts before they ship.", icon: "SearchCheck" },
  ]);
  const packagingBenefitsSection = await upsertSection(packagingPage.id, { sectionKey: "packaging.benefits", title: "What Partnering Saves You", sortOrder: 3 });
  await clearAndAddBlocks(packagingBenefitsSection.id, [
    { blockType: "capability", title: "Lower Staffing Overhead", description: "Reduced need for in-house assembly and packaging teams.", icon: "Building2" },
    { blockType: "capability", title: "Lower Warehousing Cost", description: "Less space tied up holding partially assembled inventory.", icon: "Warehouse" },
    { blockType: "capability", title: "Lower Transport Cost", description: "Fewer shipping legs between assembly and final delivery.", icon: "Truck" },
    { blockType: "capability", title: "Centralised Control", description: "One location accountable for the full assembly and packaging run.", icon: "ClipboardCheck" },
  ]);
  const packagingFaqSection = await upsertSection(packagingPage.id, { sectionKey: "packaging.faqs", title: "FAQs", sortOrder: 4 });
  await clearAndAddBlocks(packagingFaqSection.id, [
    { blockType: "faq", title: "Does Modern Orthodontics offer full or partial product assembly?", description: "Both — our facility is built for complete and partial product assembly depending on what a project needs." },
    { blockType: "faq", title: "What finishing services are available alongside packaging?", description: "Tack and custom welding, brazing, colour coding, surface finishing, laser etching and engraving, plus inspection, sorting and rework." },
    { blockType: "faq", title: "Can packaging be customised for our brand?", description: "Yes, custom labelling and packaging are part of the standard assembly and packaging service." },
    { blockType: "faq", title: "What cost savings come from outsourcing assembly and packaging to MO?", description: "Most partners reduce in-house assembly and packaging staffing, cut warehousing and transport costs, and gain centralised inventory control." },
  ]);


  const existingFooter = await prisma.cMSFooter.findFirst();
  if (existingFooter) {
    await prisma.cMSFooter.update({
      where: { id: existingFooter.id },
      data: {
        title: "Modern Orthodontics. All rights reserved.",
        description: "Stay up to date on the latest news and more.",
        email: "orders@modortho.com",
        phone: "1800 890 8022",
        address: "2024, Gobind Nagar, Circuit House Road, Ludhiana 141001, India",
        socialLinksJson: {
          facebook: "https://www.facebook.com/orthodonticsmodern",
          linkedin: "https://in.linkedin.com/company/modern-orthodontics",
          twitter: "https://twitter.com/ModOrtho",
          instagram: "https://www.instagram.com/modern_ortho/",
        } as Prisma.JsonObject,
        newsletterEnabled: true,
        status: "ACTIVE",
      },
    });
  } else {
    await prisma.cMSFooter.create({
      data: {
        title: "Modern Orthodontics. All rights reserved.",
        description: "Stay up to date on the latest news and more.",
        email: "orders@modortho.com",
        phone: "1800 890 8022",
        address: "2024, Gobind Nagar, Circuit House Road, Ludhiana 141001, India",
        socialLinksJson: {
          facebook: "https://www.facebook.com/orthodonticsmodern",
          linkedin: "https://in.linkedin.com/company/modern-orthodontics",
          twitter: "https://twitter.com/ModOrtho",
          instagram: "https://www.instagram.com/modern_ortho/",
        } as Prisma.JsonObject,
        newsletterEnabled: true,
        status: "ACTIVE",
      },
    });
  }

  await upsertCmsMenuWithItems({
    name: "Header Primary",
    location: "header-primary",
    items: [
      { key: "quality", label: "Quality Certifications", url: "/quality-certifications" },
      { key: "contact", label: "Contact Us", url: "/contact" },
    ],
  });

  await upsertCmsMenuWithItems({
    name: "Header Capabilities",
    location: "header-capabilities",
    items: [
      { key: "design", label: "Design & Engineering", url: "/design-and-engineering" },
      { key: "manufacturing", label: "Manufacturing Services", url: "/manufacturing-services" },
      { key: "oem", label: "OEM Services", url: "/oem-services" },
      { key: "packaging", label: "Custom Packaging", url: "/custom-packaging" },
    ],
  });

  await upsertCmsMenuWithItems({
    name: "Header Products Mega Menu",
    location: "header-products-mega",
    items: [
      { key: "aesthetic", label: "Aesthetic Brackets", url: "/products?category=aesthetic-brackets" },
      { key: "aesthetic-curio", label: "Curio Mono-Crystalline Ceramic", url: "/products/curio-mono-crystalline-ceramic", parentKey: "aesthetic" },
      { key: "aesthetic-purity-ms", label: "Purity-MS Metal Slot Ceramic", url: "/products?category=aesthetic-brackets", parentKey: "aesthetic" },
      { key: "aesthetic-purity", label: "Purity Ceramic", url: "/products?category=aesthetic-brackets", parentKey: "aesthetic" },
      { key: "aesthetic-dart", label: "d'art Mini Ceramic", url: "/products?category=aesthetic-brackets", parentKey: "aesthetic" },
      { key: "aesthetic-elegant", label: "Elegant Composite", url: "/products?category=aesthetic-brackets", parentKey: "aesthetic" },
      { key: "metal", label: "Metal Brackets", url: "/products?category=metal-brackets" },
      { key: "metal-sapphire-twin", label: "Sapphire True Twin", url: "/products/sapphire-true-twin", parentKey: "metal" },
      { key: "metal-sapphire-plus", label: "Sapphire Plus Low-Profile", url: "/products/sapphire-plus-low-profile", parentKey: "metal" },
      { key: "metal-atease", label: "At-Ease Self Ligating", url: "/products/at-ease-self-ligating", parentKey: "metal" },
      { key: "metal-micro", label: "Micro-LP Mini", url: "/products?category=metal-brackets", parentKey: "metal" },
      { key: "metal-bio", label: "Sapphire Brackets (Bio-Progressive)", url: "/products?category=metal-brackets", parentKey: "metal" },
      { key: "metal-edgewise", label: "Sapphire Brackets (Standard Edgewise)", url: "/products?category=metal-brackets", parentKey: "metal" },
      { key: "niti", label: "NiTi Wires", url: "/products?category=niti-wires" },
      { key: "niti-super", label: "NiTi Super Elastic", url: "/products/niti-super-elastic", parentKey: "niti" },
      { key: "niti-thermal", label: "NiTi Thermal", url: "/products?category=niti-wires", parentKey: "niti" },
      { key: "niti-rcs", label: "NiTi RCS", url: "/products?category=niti-wires", parentKey: "niti" },
      { key: "niti-spooled", label: "Spooled NiTi Wire", url: "/products?category=niti-wires", parentKey: "niti" },
      { key: "niti-springs", label: "NiTi Springs", url: "/products?category=niti-wires", parentKey: "niti" },
      { key: "ss", label: "SS Wires", url: "/products?category=ss-wires" },
      { key: "ss-acti", label: "Acti-4S Stainless Steel Archwire", url: "/products?category=ss-wires", parentKey: "ss" },
      { key: "ss-ligature", label: "Ligature Wires", url: "/products?category=ss-wires", parentKey: "ss" },
      { key: "ss-coaxial", label: "Co-Axial Wire", url: "/products?category=ss-wires", parentKey: "ss" },
      { key: "ss-retainer", label: "Fixed Retainer Wire", url: "/products?category=ss-wires", parentKey: "ss" },
      { key: "special", label: "Special Wires", url: "/products?category=special-wires" },
      { key: "special-posted", label: "Posted SS Wire", url: "/products?category=special-wires", parentKey: "special" },
      { key: "special-beta", label: "Beta Titanium", url: "/products?category=special-wires", parentKey: "special" },
      { key: "special-torqued", label: "Pre-Torqued Archwire", url: "/products?category=special-wires", parentKey: "special" },
      { key: "special-three-force", label: "Three Force Arch Wire", url: "/products?category=special-wires", parentKey: "special" },
      { key: "bands", label: "Molar Bands", url: "/products?category=molar-bands" },
      { key: "bands-plain", label: "Plain Bands", url: "/products?category=molar-bands", parentKey: "bands" },
      { key: "bands-prewelded", label: "Pre-welded Bands", url: "/products?category=molar-bands", parentKey: "bands" },
      { key: "tubes", label: "Molar Tubes", url: "/products?category=molar-tubes" },
      { key: "tubes-elfin-bondable", label: "Elfin Bondable Molar Tube", url: "/products?category=molar-tubes", parentKey: "tubes" },
      { key: "tubes-afix", label: "Afix Bondable Molar Tube", url: "/products?category=molar-tubes", parentKey: "tubes" },
      { key: "tubes-elfin-weldable", label: "Elfin Weldable Molar Tube", url: "/products?category=molar-tubes", parentKey: "tubes" },
      { key: "elastomerics", label: "Elastomerics", url: "/products?category=elastomerics" },
      { key: "elastomerics-ties", label: "Elastic Ties", url: "/products?category=elastomerics", parentKey: "elastomerics" },
      { key: "elastomerics-chain", label: "Elastomeric Chain", url: "/products?category=elastomerics", parentKey: "elastomerics" },
      { key: "elastomerics-separators", label: "Elastomeric Separators", url: "/products?category=elastomerics", parentKey: "elastomerics" },
      { key: "elastomerics-thread", label: "Elastomeric Thread", url: "/products?category=elastomerics", parentKey: "elastomerics" },
      { key: "elastomerics-guard", label: "Elastomeric Tissue Guard", url: "/products?category=elastomerics", parentKey: "elastomerics" },
      { key: "elastomerics-sleeve", label: "Archwire Sleeve", url: "/products?category=elastomerics", parentKey: "elastomerics" },
      { key: "tooth-color", label: "Tooth Color Wire", url: "/products?category=tooth-color-wire" },
      { key: "tooth-color-niti", label: "Micro-KOT NiTi", url: "/products?category=tooth-color-wire", parentKey: "tooth-color" },
      { key: "tooth-color-ss", label: "Micro-KOT SS", url: "/products?category=tooth-color-wire", parentKey: "tooth-color" },
      { key: "begg", label: "Begg Appliances", url: "/products?category=begg-appliances" },
      { key: "begg-brackets-bondable", label: "Begg Brackets (Bondable)", url: "/products?category=begg-appliances", parentKey: "begg" },
      { key: "begg-brackets-weldable", label: "Begg Brackets (Weldable)", url: "/products?category=begg-appliances", parentKey: "begg" },
      { key: "begg-bondable-tube", label: "Begg Molar Tubes (Bondable)", url: "/products?category=begg-appliances", parentKey: "begg" },
      { key: "begg-lock-pins", label: "Lock Pins", url: "/products?category=begg-appliances", parentKey: "begg" },
      { key: "misc", label: "Miscellaneous Items", url: "/products?category=miscellaneous-items" },
      { key: "misc-implants", label: "Micro Implants", url: "/products?category=miscellaneous-items", parentKey: "misc" },
      { key: "misc-lab-wire", label: "Stainless Steel Lab Wire", url: "/products?category=miscellaneous-items", parentKey: "misc" },
      { key: "misc-strips", label: "Diamond Proximal Strips", url: "/products?category=miscellaneous-items", parentKey: "misc" },
      { key: "misc-retractor", label: "Lip & Cheek Retractor", url: "/products?category=miscellaneous-items", parentKey: "misc" },
      { key: "misc-hyrex", label: "Hyrex RME Screw", url: "/products?category=miscellaneous-items", parentKey: "misc" },
      { key: "misc-base-former", label: "Base Former", url: "/products?category=miscellaneous-items", parentKey: "misc" },
    ],
  });

  await upsertCmsMenuWithItems({
    name: "Header CTA",
    location: "header-cta",
    items: [{ key: "become-dealer", label: "Become a Dealer", url: "/contact" }],
  });

  await upsertCmsMenuWithItems({
    name: "About Us",
    location: "footer-about",
    items: [
      { key: "about", label: "About Us", url: "/about" },
      { key: "manufacturing", label: "Manufacturing", url: "/manufacturing-services" },
      { key: "quality", label: "Quality Certifications", url: "/quality-certifications" },
      { key: "mission", label: "Mission", url: "/about#mission" },
    ],
  });

  await upsertCmsMenuWithItems({
    name: "Products",
    location: "footer-products",
    items: [
      { key: "aesthetic", label: "Aesthetic Brackets", url: "/products?category=aesthetic-brackets" },
      { key: "metal", label: "Metal Brackets", url: "/products?category=metal-brackets" },
      { key: "niti", label: "NiTi & SS Wires", url: "/products?category=niti-wires" },
      { key: "bands", label: "Molar Bands & Tubes", url: "/products?category=molar-bands" },
    ],
  });

  await upsertCmsMenuWithItems({
    name: "Capabilities",
    location: "footer-capabilities",
    items: [
      { key: "design", label: "Design & Engineering", url: "/design-and-engineering" },
      { key: "oem", label: "OEM Services", url: "/oem-services" },
      { key: "packaging", label: "Custom Packaging", url: "/custom-packaging" },
      { key: "quality", label: "Quality Control", url: "/quality-certifications" },
    ],
  });

  await upsertCmsMenuWithItems({
    name: "Dealers & Bulk Orders",
    location: "footer-dealers",
    items: [
      { key: "dealer", label: "Become a Dealer", url: "/contact" },
      { key: "rfq", label: "Bulk & RFQ Pricing", url: "/products" },
      { key: "catalogue", label: "Product Catalogue", url: "https://www.modortho.com/public/catalog/Modern-Catalog.zip", openInNewTab: true },
    ],
  });

  await upsertCmsMenuWithItems({
    name: "Resources",
    location: "footer-resources",
    items: [
      { key: "blog", label: "Blog", url: "/blog", openInNewTab: false },
      { key: "terms", label: "Terms & Conditions", url: "/terms-and-conditions", openInNewTab: false },
      { key: "privacy", label: "Privacy Policy", url: "/privacy-policy", openInNewTab: false },
    ],
  });

  await upsertCmsMenuWithItems({
    name: "Export & Trade",
    location: "footer-export",
    items: [
      { key: "enquiries", label: "Export Enquiries", url: "/contact" },
      { key: "distributors", label: "Global Distributors", url: "/contact" },
      { key: "shipping", label: "Shipping & Logistics", url: "/contact" },
      { key: "compliance", label: "Compliance Documents", url: "/quality-certifications" },
    ],
  });

  await upsertCmsMenuWithItems({
    name: "India Office",
    location: "footer-india-office",
    items: [
      { key: "orders", label: "orders@modortho.com", url: "mailto:orders@modortho.com" },
      { key: "info", label: "info@modortho.com", url: "mailto:info@modortho.com" },
      { key: "phone", label: "1800 890 8022", url: "" },
      { key: "address", label: "2024, Gobind Nagar, Circuit House Road, Ludhiana 141001, India", url: "" },
    ],
  });

  await upsertCmsMenuWithItems({
    name: "USA Office",
    location: "footer-usa-office",
    items: [
      { key: "email", label: "sanjaygoyalmo@gmail.com", url: "mailto:sanjaygoyalmo@gmail.com" },
      { key: "phone", label: "+1 470-866-2724", url: "" },
      { key: "address", label: "1303 Colony Dr, Marietta, GA 30068, USA", url: "" },
    ],
  });

  await upsertCmsMenuWithItems({
    name: "Legal",
    location: "footer-legal",
    items: [
      { key: "privacy", label: "Privacy Policy", url: "/privacy-policy" },
      { key: "sitemap", label: "Sitemap", url: "/sitemap" },
    ],
  });

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
    { key: "general.logo_alt", value: "Modern Orthodontics", group: "general", label: "Logo Alt Text", type: "string" },
    { key: "general.mobile_logo", value: "", group: "general", label: "Mobile Logo URL", type: "string" },
    { key: "general.favicon", value: "", group: "general", label: "Favicon URL", type: "string" },
    { key: "general.default_language", value: "en", group: "general", label: "Default Language", type: "string" },
    { key: "general.default_currency", value: "INR", group: "general", label: "Default Currency", type: "string" },
    { key: "general.timezone", value: "Asia/Kolkata", group: "general", label: "Timezone", type: "string" },
    // Tax & Compliance
    { key: "tax.seller_name", value: "Modern Orthodontics Pvt Ltd", group: "tax", label: "Seller Legal Name", type: "string" },
    { key: "tax.seller_gstin", value: "03AAAAA1111A1Z1", group: "tax", label: "Seller GSTIN (India)", type: "string" },
    { key: "tax.seller_iec", value: "0300000000", group: "tax", label: "Seller Import Export Code (IEC)", type: "string" },
    { key: "tax.ship_from_state", value: "Punjab", group: "tax", label: "Fulfillment Origin State", type: "string" },
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
    // Auth pages
    { key: "auth.login_heading", value: "Customer Login", group: "auth", label: "Login Heading", type: "string" },
    { key: "auth.login_sub_heading", value: "Login to access your account", group: "auth", label: "Login Sub Heading", type: "string" },
    { key: "auth.login_slider_enabled", value: "true", group: "auth", label: "Enable Login Slider", type: "boolean" },
    { key: "auth.login_slide_1_image", value: "/auth/login1.jpg", group: "auth", label: "Login Slide 1 Image", type: "string" },
    { key: "auth.login_slide_1_heading", value: "Modern orthodontic care designed for confident smiles.", group: "auth", label: "Login Slide 1 Heading", type: "string" },
    { key: "auth.login_slide_1_sub_heading", value: "Premium products and account access for dental professionals.", group: "auth", label: "Login Slide 1 Sub Heading", type: "string" },
    { key: "auth.login_slide_2_image", value: "/auth/login2.jpg", group: "auth", label: "Login Slide 2 Image", type: "string" },
    { key: "auth.login_slide_2_heading", value: "Track your treatment journey with ease and comfort.", group: "auth", label: "Login Slide 2 Heading", type: "string" },
    { key: "auth.login_slide_2_sub_heading", value: "Manage orders, quotes, and account details in one secure place.", group: "auth", label: "Login Slide 2 Sub Heading", type: "string" },
    {
      key: "auth.login_slides",
      value: JSON.stringify([
        {
          image: "/auth/login1.jpg",
          heading: "Modern orthodontic care designed for confident smiles.",
          subHeading: "Premium products and account access for dental professionals.",
          isVisible: true,
        },
        {
          image: "/auth/login2.jpg",
          heading: "Track your treatment journey with ease and comfort.",
          subHeading: "Manage orders, quotes, and account details in one secure place.",
          isVisible: true,
        },
      ]),
      group: "auth",
      label: "Login Slides",
      type: "json",
    },
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

  // ─── Header CMS Menus ─────────────────────────────────────
  const existingCapsMenu = await prisma.cMSMenu.findUnique({ where: { location: "header-capabilities" } });
  if (!existingCapsMenu) {
    await prisma.cMSMenu.create({
      data: {
        name: "Header Capabilities",
        location: "header-capabilities",
        status: "ACTIVE",
        items: {
          create: [
            { label: "Design & Engineering", url: "/capabilities/design-engineering", sortOrder: 0, status: "ACTIVE" },
            { label: "Manufacturing Services", url: "/capabilities/manufacturing-services", sortOrder: 1, status: "ACTIVE" },
            { label: "OEM Services", url: "/capabilities/oem-services", sortOrder: 2, status: "ACTIVE" },
            { label: "Custom Packaging", url: "/capabilities/custom-packaging", sortOrder: 3, status: "ACTIVE" },
          ],
        },
      },
    });
  }

  const existingProductsMegaMenu = await prisma.cMSMenu.findUnique({ where: { location: "header-products-mega" } });
  if (!existingProductsMegaMenu) {
    const categories = await prisma.category.findMany({ where: { deletedAt: null }, orderBy: { sortOrder: "asc" } });

    const megaMenu = await prisma.cMSMenu.create({
      data: {
        name: "Header Products Mega Menu",
        location: "header-products-mega",
        status: "ACTIVE",
      },
    });

    if (categories.length > 0) {
      const parentCol = await prisma.cMSMenuItem.create({
        data: {
          menuId: megaMenu.id,
          label: "Product Categories",
          url: "/products",
          sortOrder: 0,
          status: "ACTIVE",
        },
      });

      for (let i = 0; i < categories.length; i++) {
        const cat = categories[i];
        await prisma.cMSMenuItem.create({
          data: {
            menuId: megaMenu.id,
            parentId: parentCol.id,
            label: cat.name,
            url: `/products?category=${cat.slug}`,
            sortOrder: i,
            status: "ACTIVE",
          },
        });
      }
    } else {
      const bracketsCol = await prisma.cMSMenuItem.create({
        data: { menuId: megaMenu.id, label: "Bracket Systems", url: "/products?category=bracket-systems", sortOrder: 0, status: "ACTIVE" },
      });
      await prisma.cMSMenuItem.create({
        data: { menuId: megaMenu.id, parentId: bracketsCol.id, label: "Aesthetic Brackets", url: "/products?category=aesthetic-brackets", sortOrder: 0, status: "ACTIVE" },
      });
      await prisma.cMSMenuItem.create({
        data: { menuId: megaMenu.id, parentId: bracketsCol.id, label: "Metal Brackets", url: "/products?category=metal-brackets", sortOrder: 1, status: "ACTIVE" },
      });
    }
  }

  console.log(`✅ Seed complete.`);
  console.log(`   Admin login: ${adminEmail}`);
  console.log(`   Roles created: Super Admin, Admin, Staff`);
  console.log(`   Sample products: Elfin Bondable Molar Tube, NiTi Wire Product`);
  console.log(`   CMS pages seeded: home, about, manufacturing, contact, products, quality-certifications, design-and-engineering, oem-services, custom-packaging`);
  console.log(`   Settings seeded: ${defaultSettings.length} default keys across all groups`);
}

main()
  .catch((err) => { console.error("Seed failed:", err); process.exit(1); })
  .finally(() => prisma.$disconnect());
