import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { AppError } from "../../utils/apiResponse";
import { logger } from "../../config/logger";
import {
  SYSTEM_CUSTOMER_ROLE_KEYS,
  buildRolePriceLayer,
  ensureCustomerRoleByKey,
  resolveCustomerRoleFromCustomer,
} from "../customerRoles/customerRoles.service";
import { supportsPromotionalDiscountType, type DiscountRuleKind } from "../discounts/discountRules";

export type TaxBreakdownStructure = {
  taxType: "CGST_SGST" | "IGST" | "VAT" | "EXEMPT";
  cgst?: number;
  sgst?: number;
  igst?: number;
  vat?: number;
  totalTax: number;
  rate: number;
  ruleIdsApplied: string[];
};

type ResolvePriceInput = {
  productId: string;
  variantId?: string | null;
  countryId: string;
  customerId?: string | null;
  customerRoleKey?: string | null;
  tierId?: string | null;
  quantity: number;
  buyerState?: string | null;
  sellerState?: string | null;
};

type ResolvedPricingContext = {
  role: Awaited<ReturnType<typeof resolveCustomerRoleFromCustomer>>;
  tierId: string | null;
  tierEligibleForCountry: boolean;
};

export type AppliedPriceLayer = {
  type: "BASE_PRICE" | "ROLE_PRICE" | "TIER_PRICE" | "MOQ_PRICE" | "PROMOTIONAL_DISCOUNT" | "TAX";
  label: string;
  amountBefore: number;
  amountAfter: number;
  discountPercent?: number | null;
  fixedPrice?: number | null;
  fixedAmount?: number | null;
  taxPercent?: number | null;
  taxAmount?: number | null;
  taxRuleType?: "CGST" | "SGST" | "VAT" | "SALES_TAX" | "LEGACY_PRODUCT_PRICE_TAX";
  discountRuleType?: DiscountRuleKind;
  ruleId?: string;
  warning?: string;
  isSpecific?: boolean;
};

export type ResolvedPrice = {
  basePrice: number;
  appliedDiscounts: AppliedPriceLayer[];
  priceBeforeTax: number;
  taxAmount: number;
  taxMode: string;
  taxBreakdownStructure?: TaxBreakdownStructure;
  finalPrice: number;
  currency: {
    id: string;
    code: string;
    symbol: string;
  };
  landedCost?: {
    dutyPercentage: number;
    dutyAmount: number;
    shippingCharge: number;
    countryId: string;
    countryCode: string;
  };
};

function money(value: Prisma.Decimal | number | string | null | undefined) {
  return Number(value ?? 0);
}

type ActiveTaxRule = {
  id: string;
  name: string;
  type: "CGST" | "SGST" | "VAT" | "SALES_TAX";
  percentage: Prisma.Decimal | number;
};

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function applyRule(
  currentPrice: number,
  rule: { id: string; discountPercent: Prisma.Decimal | number | null; fixedPrice: Prisma.Decimal | number | null },
  type: AppliedPriceLayer["type"],
  label: string
) {
  const amountBefore = currentPrice;
  const discountPercent = rule.discountPercent == null ? null : money(rule.discountPercent);
  const fixedPrice = rule.fixedPrice == null ? null : money(rule.fixedPrice);
  const amountAfter = fixedPrice != null ? fixedPrice : roundMoney(currentPrice * (1 - (discountPercent ?? 0) / 100));

  return {
    nextPrice: amountAfter,
    layer: {
      type,
      label,
      amountBefore,
      amountAfter,
      discountPercent,
      fixedPrice,
      ruleId: rule.id,
    } satisfies AppliedPriceLayer,
  };
}

type PromotionalDiscount = {
  id: string;
  name: string;
  type: DiscountRuleKind;
  products: { id: string }[];
  collections: { id: string }[];
  categories: { id: string }[];
  countries: { id: string }[];
  discountPercent: Prisma.Decimal | null;
  fixedAmount: Prisma.Decimal | null;
  createdAt: Date;
};

function applyPromotionalDiscount(currentPrice: number, rule: PromotionalDiscount) {
  const amountBefore = currentPrice;
  const discountPercent = rule.discountPercent == null ? null : money(rule.discountPercent);
  const fixedAmount = rule.fixedAmount == null ? null : money(rule.fixedAmount);
  const discountAmount = fixedAmount != null ? fixedAmount : roundMoney(currentPrice * ((discountPercent ?? 0) / 100));
  const amountAfter = roundMoney(Math.max(0, currentPrice - discountAmount));

  const layer: AppliedPriceLayer = {
    type: "PROMOTIONAL_DISCOUNT",
    label: `${rule.name} ${rule.type === "TIER" ? "tier" : rule.type === "MOQ" ? "MOQ" : "promotional"} discount`,
    amountBefore,
    amountAfter,
    discountPercent,
    fixedAmount,
    discountRuleType: rule.type,
    ruleId: rule.id,
  };

  return {
    nextPrice: amountAfter,
    layer,
  };
}

function discountScopeRank(discount: PromotionalDiscount) {
  if (discount.products && discount.products.length > 0) return 4;
  if (discount.collections && discount.collections.length > 0) return 3;
  if (discount.categories && discount.categories.length > 0) return 2;
  return 1;
}

function discountCountryRank(discount: PromotionalDiscount) {
  return discount.countries && discount.countries.length > 0 ? 2 : 1;
}

function selectBestPromotionalDiscount(discounts: PromotionalDiscount[], currentPrice: number) {
  if (discounts.length === 0) return null;

  const ranked = [...discounts].sort((a, b) => {
    const scopeDiff = discountScopeRank(b) - discountScopeRank(a);
    if (scopeDiff !== 0) return scopeDiff;
    const countryDiff = discountCountryRank(b) - discountCountryRank(a);
    if (countryDiff !== 0) return countryDiff;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  const topScope = discountScopeRank(ranked[0]);
  const topCountry = discountCountryRank(ranked[0]);
  const sameSpecificity = ranked.filter(
    (discount) => discountScopeRank(discount) === topScope && discountCountryRank(discount) === topCountry
  );

  if (sameSpecificity.length === 1) {
    return { discount: sameSpecificity[0], warning: null };
  }

  const byValue = sameSpecificity
    .map((discount) => ({ discount, applied: applyPromotionalDiscount(currentPrice, discount) }))
    .sort((a, b) => a.applied.nextPrice - b.applied.nextPrice || b.discount.createdAt.getTime() - a.discount.createdAt.getTime());
  const warning = `Multiple ${sameSpecificity[0].type} discounts match at the same specificity; applied the largest effective discount.`;
  logger.warn(`${warning} ids=${sameSpecificity.map((discount) => discount.id).join(",")}`);

  return { discount: byValue[0].discount, warning };
}

async function findPromotionalDiscounts(
  input: ResolvePriceInput,
  type: DiscountRuleKind,
  productCategoryId: string | null,
  productCollectionIds: string[],
  tierId?: string | null
) {
  if (type === "TIER" && !tierId) return [];
  if (type === "PROMOTIONAL" && !(await supportsPromotionalDiscountType())) return [];

  const now = new Date();
  const startOfCurrentDay = new Date(now);
  startOfCurrentDay.setUTCHours(0, 0, 0, 0);

  const scopeFilters: Prisma.DiscountWhereInput[] = [
    { products: { some: { productId: input.productId } } },
    { products: { none: {} }, collections: { none: {} }, categories: { none: {} } },
  ];
  if (productCollectionIds.length) {
    scopeFilters.push({ collections: { some: { collectionId: { in: productCollectionIds } } } });
  }
  if (productCategoryId) {
    scopeFilters.push({ categories: { some: { categoryId: productCategoryId } } });
  }

  const discounts = await prisma.discount.findMany({
    where: {
      type,
      status: "ACTIVE",
      ...(type === "TIER" ? { tierId } : {}),
      ...(type === "MOQ" ? { minQuantity: { lte: input.quantity } } : {}),
      OR: scopeFilters,
      AND: [
        { OR: [{ countries: { some: { countryId: input.countryId } } }, { countries: { none: {} } }] },
        { OR: [{ startDate: null }, { startDate: { lte: now } }] },
        { OR: [{ endDate: null }, { endDate: { gte: startOfCurrentDay } }] },
      ],
    },
    include: {
      products: { select: { productId: true } },
      collections: { select: { collectionId: true } },
      categories: { select: { categoryId: true } },
      countries: { select: { countryId: true } },
    },
  });

  return discounts.map((d) => ({
    ...d,
    products: d.products.map((p) => ({ id: p.productId })),
    collections: d.collections.map((c) => ({ id: c.collectionId })),
    categories: d.categories.map((c) => ({ id: c.categoryId })),
    countries: d.countries.map((c) => ({ id: c.countryId })),
  }));
}

async function findBasePrice(input: ResolvePriceInput) {
  const lookups: Prisma.ProductPriceWhereInput[] = [];

  if (input.variantId) {
    lookups.push({
      productId: input.productId,
      variantId: input.variantId,
      countryId: input.countryId,
      status: "ACTIVE",
    });
  }

  lookups.push({
    productId: input.productId,
    variantId: null,
    countryId: input.countryId,
    status: "ACTIVE",
  });

  for (const where of lookups) {
    const price = await prisma.productPrice.findFirst({
      where,
      include: { currency: true, country: true },
    });
    if (price) return price;
  }

  return null;
}

async function resolvePricingContext(input: ResolvePriceInput): Promise<ResolvedPricingContext> {
  const role = input.customerId
    ? await resolveCustomerRoleFromCustomer(input.customerId)
    : input.customerRoleKey
      ? await ensureCustomerRoleByKey(input.customerRoleKey)
      : await ensureCustomerRoleByKey(SYSTEM_CUSTOMER_ROLE_KEYS.guest);

  const tierId = input.customerId
    ? (input.tierId ?? (
        await prisma.customer.findUnique({
          where: { id: input.customerId, deletedAt: null },
          select: { tierId: true },
        })
      )?.tierId ?? null)
    : input.tierId ?? null;

  if (!tierId) {
    return {
      role,
      tierId: null,
      tierEligibleForCountry: false,
    };
  }

  const tier = await prisma.tier.findUnique({
    where: { id: tierId },
    select: {
      id: true,
      status: true,
      countries: {
        select: {
          countryId: true,
          enabled: true,
        },
      },
    },
  });

  if (!tier || tier.status !== "ACTIVE") {
    return {
      role,
      tierId: null,
      tierEligibleForCountry: false,
    };
  }

  const hasCountryMappings = tier.countries.length > 0;
  const tierEligibleForCountry = hasCountryMappings
    ? tier.countries.some((mapping) => mapping.countryId === input.countryId && mapping.enabled)
    : true;

  return {
    role,
    tierId: tier.id,
    tierEligibleForCountry,
  };
}

async function findTierRule(
  input: ResolvePriceInput,
  tierId: string,
) {
  const lookups: Prisma.TierPricingWhereInput[] = [];

  if (input.variantId) {
    lookups.push({
      productId: input.productId,
      variantId: input.variantId,
      countryId: input.countryId,
      tierId,
    });
  }

  lookups.push({
    productId: input.productId,
    variantId: null,
    countryId: input.countryId,
    tierId,
  });

  for (const where of lookups) {
    const rule = await prisma.tierPricing.findFirst({
      where,
      include: { tier: true },
    });
    if (rule) return rule;
  }

  return null;
}

async function findMoqRule(input: ResolvePriceInput) {
  const lookups: Prisma.MoqPricingWhereInput[] = [];

  if (input.variantId) {
    lookups.push({
      productId: input.productId,
      variantId: input.variantId,
      countryId: input.countryId,
      minQuantity: { lte: input.quantity },
    });
  }

  lookups.push({
    productId: input.productId,
    variantId: null,
    countryId: input.countryId,
    minQuantity: { lte: input.quantity },
  });

  for (const where of lookups) {
    const rule = await prisma.moqPricing.findFirst({
      where,
      orderBy: { minQuantity: "desc" },
    });
    if (rule) return rule;
  }

  return null;
}

export async function resolvePrice(input: ResolvePriceInput): Promise<ResolvedPrice> {
  if (!input.countryId) throw new AppError("Country is required for price resolution.", 400);
  if (!Number.isInteger(input.quantity) || input.quantity < 1) {
    throw new AppError("Quantity must be at least 1.", 400);
  }

  const [basePrice, product, pricingContext] = await Promise.all([
    findBasePrice(input),
    prisma.product.findUnique({
      where: { id: input.productId },
      select: { categoryId: true, collections: { select: { collectionId: true } } },
    }),
    resolvePricingContext(input),
  ]);

  if (!basePrice) {
    throw new AppError("No active price is configured for this product/variant in the selected country.", 400);
  }

  const productCollectionIds = product?.collections.map((item) => item.collectionId) ?? [];
  let currentPrice = money(basePrice.sellingPrice);
  const layers: AppliedPriceLayer[] = [
    {
      type: "BASE_PRICE",
      label: basePrice.variantId ? "Variant country price" : "Product country price",
      amountBefore: currentPrice,
      amountAfter: currentPrice,
    },
  ];

  if (pricingContext.role.key === SYSTEM_CUSTOMER_ROLE_KEYS.dealer && basePrice.dealerPrice != null) {
    const appliedRolePrice = buildRolePriceLayer(currentPrice, basePrice.dealerPrice, `${pricingContext.role.name} role price`);
    currentPrice = appliedRolePrice.nextPrice;
    layers.push(appliedRolePrice.layer);
  }

  if (pricingContext.role.key === SYSTEM_CUSTOMER_ROLE_KEYS.doctorRetailer && basePrice.distributorPrice != null) {
    const appliedRolePrice = buildRolePriceLayer(currentPrice, basePrice.distributorPrice, `${pricingContext.role.name} role price`);
    currentPrice = appliedRolePrice.nextPrice;
    layers.push(appliedRolePrice.layer);
  }

  if (pricingContext.tierId && pricingContext.tierEligibleForCountry) {
    const tierRule = await findTierRule(input, pricingContext.tierId);

    if (tierRule) {
      const applied = applyRule(currentPrice, tierRule, "TIER_PRICE", `${tierRule.tier.name} tier pricing`);
      currentPrice = applied.nextPrice;
      layers.push(applied.layer);
    }
  }

  const moqRule = await findMoqRule(input);

  if (moqRule) {
    const applied = applyRule(currentPrice, moqRule, "MOQ_PRICE", `${moqRule.minQuantity}+ unit MOQ pricing`);
    currentPrice = applied.nextPrice;
    layers.push(applied.layer);
  }
  const resolvedTierPrice = currentPrice;

  const promotionalTierDiscount = selectBestPromotionalDiscount(
    pricingContext.tierId && pricingContext.tierEligibleForCountry
      ? await findPromotionalDiscounts(input, "TIER", product?.categoryId ?? null, productCollectionIds, pricingContext.tierId)
      : [],
    currentPrice
  );
  if (promotionalTierDiscount) {
    const applied = applyPromotionalDiscount(currentPrice, promotionalTierDiscount.discount);
    if (promotionalTierDiscount.warning) applied.layer.warning = promotionalTierDiscount.warning;
    currentPrice = applied.nextPrice;
    layers.push(applied.layer);
  }

  const promotionalMoqDiscount = selectBestPromotionalDiscount(
    await findPromotionalDiscounts(input, "MOQ", product?.categoryId ?? null, productCollectionIds),
    currentPrice
  );
  if (promotionalMoqDiscount) {
    const applied = applyPromotionalDiscount(currentPrice, promotionalMoqDiscount.discount);
    if (promotionalMoqDiscount.warning) applied.layer.warning = promotionalMoqDiscount.warning;
    currentPrice = applied.nextPrice;
    layers.push(applied.layer);
  }

  const openPromotionalDiscount = selectBestPromotionalDiscount(
    await findPromotionalDiscounts(input, "PROMOTIONAL", product?.categoryId ?? null, productCollectionIds),
    currentPrice
  );
  if (openPromotionalDiscount) {
    const applied = applyPromotionalDiscount(currentPrice, openPromotionalDiscount.discount);
    if (openPromotionalDiscount.warning) applied.layer.warning = openPromotionalDiscount.warning;
    currentPrice = applied.nextPrice;
    layers.push(applied.layer);
  }

  // Extension point: code-based coupons can append another PROMOTIONAL_DISCOUNT layer after automatic discounts.
  const priceBeforeTax = roundMoney(currentPrice);
  let totalTaxAmount = 0;

  // 1. Fetch dynamic settings and tax rules
  const [shipFromStateSetting, destinationCountry] = await Promise.all([
    prisma.setting.findFirst({ where: { key: "tax.ship_from_state" } }),
    prisma.country.findUnique({ where: { id: input.countryId }, select: { code: true } }),
  ]);
  const defaultSellerState = shipFromStateSetting?.value || "Punjab";
  const destinationCountryCode = destinationCountry?.code?.toUpperCase() || "IN";

  // 2. Fetch customer tax verification status
  let customerTaxExempt = false;
  let customerTaxId = null;
  let customerTaxIdType = null;
  if (input.customerId) {
    const customer = await prisma.customer.findUnique({
      where: { id: input.customerId },
      select: { taxId: true, taxIdType: true, taxIdStatus: true }
    });
    if (customer && customer.taxIdStatus === "VALID") {
      customerTaxExempt = true;
      customerTaxId = customer.taxId;
      customerTaxIdType = customer.taxIdType;
    }
  }

  // 3. Fetch tax rules from database
  const countryTaxRules = (await (prisma as unknown as { taxRule: { findMany: (args: unknown) => Promise<any[]> } }).taxRule.findMany({
    where: {
      OR: [
        { countries: { some: { countryId: input.countryId } } },
        { countries: { none: {} } },
      ],
      status: "ACTIVE",
    },
    include: {
      products: { select: { id: true } },
      categories: { select: { id: true } },
      variants: { select: { id: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  })) as any[];

  // Find rules matching specific variant first
  const variantSpecificRules = input.variantId
    ? countryTaxRules.filter((rule) =>
        rule.variants.some((v: any) => v.id === input.variantId)
      )
    : [];

  // Find rules matching specific product next
  const productSpecificRules = countryTaxRules.filter((rule) =>
    rule.products.some((p: any) => p.id === input.productId)
  );

  // Find rules matching product categories next
  const categorySpecificRules = product?.categoryId
    ? countryTaxRules.filter((rule) =>
        rule.categories.some((c: any) => c.id === product.categoryId)
      )
    : [];

  // Find global country-wide rules (rules with no variants, products or categories)
  const globalCountryRules = countryTaxRules.filter(
    (rule) =>
      rule.products.length === 0 &&
      rule.categories.length === 0 &&
      rule.variants.length === 0
  );

  const activeTaxRules = (
    variantSpecificRules.length > 0
      ? variantSpecificRules
      : productSpecificRules.length > 0
      ? productSpecificRules
      : categorySpecificRules.length > 0
      ? categorySpecificRules
      : globalCountryRules
  ) as ActiveTaxRule[];

  let primaryTaxMode = "EXCLUSIVE";
  let taxBreakdownStructure: TaxBreakdownStructure | undefined;
  let ruleIdApplied = null;
  let taxPercent = 0;
  let isZeroRatedExport = false;
  let isVatReverseCharge = false;

  // Evaluate final tax rate and mode
  if (destinationCountryCode !== "IN") {
    // International Exports
    if (customerTaxExempt && (destinationCountryCode === "US" || ["AT","BE","BG","CY","CZ","DE","DK","EE","ES","FI","FR","GR","HR","HU","IE","IT","LT","LU","LV","MT","NL","PL","PT","RO","SE","SI","SK","GB"].includes(destinationCountryCode))) {
      // B2B Reverse Charge or US Resale Exemption
      taxPercent = 0;
      primaryTaxMode = "EXEMPT";
      if (destinationCountryCode === "US") {
        taxBreakdownStructure = {
          taxType: "EXEMPT",
          totalTax: 0,
          rate: 0,
          ruleIdsApplied: [],
        };
      } else {
        isVatReverseCharge = true;
        taxBreakdownStructure = {
          taxType: "VAT",
          vat: 0,
          totalTax: 0,
          rate: 0,
          ruleIdsApplied: [],
        };
      }
    } else if (activeTaxRules.length > 0) {
      const selectedRule = activeTaxRules[0] as any;
      primaryTaxMode = selectedRule.taxMode || "EXCLUSIVE";
      taxPercent = money(selectedRule.percentage);
      ruleIdApplied = selectedRule.id;
    } else {
      // Default to Zero-Rated Export
      taxPercent = 0;
      primaryTaxMode = "EXEMPT";
      isZeroRatedExport = true;
      taxBreakdownStructure = {
        taxType: "EXEMPT",
        totalTax: 0,
        rate: 0,
        ruleIdsApplied: [],
      };
    }
  } else {
    // India Domestic
    if (activeTaxRules.length > 0) {
      const selectedRule = activeTaxRules[0] as any;
      primaryTaxMode = selectedRule.taxMode || "EXCLUSIVE";
      taxPercent = money(selectedRule.percentage);
      ruleIdApplied = selectedRule.id;
    } else {
      // Default to 0 when no rules are configured
      taxPercent = 0;
      primaryTaxMode = "EXEMPT";
    }
  }

  // Calculate actual amount based on taxMode
  if (primaryTaxMode === "EXEMPT") {
    totalTaxAmount = 0;
  } else if (primaryTaxMode === "INCLUSIVE") {
    totalTaxAmount = roundMoney(priceBeforeTax - priceBeforeTax / (1 + taxPercent / 100));
  } else {
    totalTaxAmount = roundMoney(priceBeforeTax * (taxPercent / 100));
  }

  // Setup breakdown structure
  const sellerStateNorm = (input.sellerState || defaultSellerState).trim().toLowerCase();
  const buyerStateNorm = (input.buyerState || "").trim().toLowerCase();
  const isSameState = !!buyerStateNorm && (
    buyerStateNorm === sellerStateNorm ||
    (buyerStateNorm === "pb" && sellerStateNorm === "punjab") ||
    (buyerStateNorm === "punjab" && sellerStateNorm === "pb") ||
    (buyerStateNorm === "rj" && sellerStateNorm === "rajasthan") ||
    (buyerStateNorm === "rajasthan" && sellerStateNorm === "rj")
  );

  if (destinationCountryCode !== "IN") {
    if (isVatReverseCharge) {
      taxBreakdownStructure = {
        taxType: "VAT",
        vat: 0,
        totalTax: 0,
        rate: 0,
        ruleIdsApplied: ruleIdApplied ? [ruleIdApplied] : [],
      };
    } else {
      const isVAT = activeTaxRules.length > 0 && activeTaxRules[0].type === "VAT";
      taxBreakdownStructure = isVAT
        ? {
            taxType: "VAT",
            vat: totalTaxAmount,
            totalTax: totalTaxAmount,
            rate: taxPercent,
            ruleIdsApplied: ruleIdApplied ? [ruleIdApplied] : [],
          }
        : {
            taxType: "EXEMPT",
            totalTax: totalTaxAmount,
            rate: taxPercent,
            ruleIdsApplied: ruleIdApplied ? [ruleIdApplied] : [],
          };
    }
  } else {
    // India splits GST into CGST/SGST or IGST
    if (isSameState) {
      const cgst = Math.round((totalTaxAmount / 2) * 100) / 100;
      const sgst = Math.round((totalTaxAmount - cgst) * 100) / 100;
      taxBreakdownStructure = {
        taxType: "CGST_SGST",
        cgst,
        sgst,
        totalTax: totalTaxAmount,
        rate: taxPercent,
        ruleIdsApplied: ruleIdApplied ? [ruleIdApplied] : [],
      };
    } else {
      taxBreakdownStructure = {
        taxType: "IGST",
        igst: totalTaxAmount,
        totalTax: totalTaxAmount,
        rate: taxPercent,
        ruleIdsApplied: ruleIdApplied ? [ruleIdApplied] : [],
      };
    }
  }

  // Push layers
  layers.push({
    type: "TAX",
    label: primaryTaxMode === "INCLUSIVE" ? "Inclusive Tax" : "Tax",
    amountBefore: priceBeforeTax,
    amountAfter: primaryTaxMode === "INCLUSIVE" ? priceBeforeTax : roundMoney(priceBeforeTax + totalTaxAmount),
    taxPercent,
    taxAmount: totalTaxAmount,
    ruleId: ruleIdApplied || undefined,
    isSpecific: productSpecificRules.length > 0,
  } as any);

  currentPrice = primaryTaxMode === "INCLUSIVE" ? priceBeforeTax : roundMoney(priceBeforeTax + totalTaxAmount);

  const countryRecord = (basePrice as { country?: { id: string; code: string; dutyPercentage: Prisma.Decimal | number; shippingCharge: Prisma.Decimal | number } }).country;
  const landedCost =
    countryRecord && (Number(countryRecord.dutyPercentage) > 0 || Number(countryRecord.shippingCharge) > 0)
      ? {
          dutyPercentage: Number(countryRecord.dutyPercentage),
          dutyAmount: roundMoney(currentPrice * (Number(countryRecord.dutyPercentage) / 100)),
          shippingCharge: Number(countryRecord.shippingCharge),
          countryId: countryRecord.id,
          countryCode: countryRecord.code,
        }
      : undefined;

  return {
    basePrice: resolvedTierPrice,
    appliedDiscounts: layers,
    priceBeforeTax,
    taxAmount: roundMoney(totalTaxAmount),
    taxMode: primaryTaxMode,
    taxBreakdownStructure,
    finalPrice: roundMoney(currentPrice),
    currency: {
      id: basePrice.currency.id,
      code: basePrice.currency.code,
      symbol: basePrice.currency.symbol,
    },
    landedCost,
  };
}
