import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { AppError } from "../../utils/apiResponse";
import { logger } from "../../config/logger";
import {
  SYSTEM_CUSTOMER_ROLE_KEYS,
  buildRolePriceLayer,
  resolveCustomerRoleFromCustomer,
} from "../customerRoles/customerRoles.service";

type ResolvePriceInput = {
  productId: string;
  variantId?: string | null;
  countryId: string;
  customerId?: string | null;
  quantity: number;
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
};

export type ResolvedPrice = {
  basePrice: number;
  appliedDiscounts: AppliedPriceLayer[];
  priceBeforeTax: number;
  taxAmount: number;
  finalPrice: number;
  currency: {
    id: string;
    code: string;
    symbol: string;
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
  productId: string | null;
  collectionId: string | null;
  categoryId: string | null;
  countryId: string | null;
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
  if (discount.productId) return 4;
  if (discount.collectionId) return 3;
  if (discount.categoryId) return 2;
  return 1;
}

function discountCountryRank(discount: PromotionalDiscount) {
  return discount.countryId ? 2 : 1;
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

  const now = new Date();
  const scopeFilters: Prisma.DiscountWhereInput[] = [
    { productId: input.productId },
    { productId: null, collectionId: null, categoryId: null },
  ];
  if (productCollectionIds.length) scopeFilters.push({ collectionId: { in: productCollectionIds } });
  if (productCategoryId) scopeFilters.push({ categoryId: productCategoryId });

  return prisma.discount.findMany({
    where: {
      type,
      status: "ACTIVE",
      ...(type === "TIER" ? { tierId } : {}),
      ...(type === "MOQ" ? { minQuantity: { lte: input.quantity } } : {}),
      OR: scopeFilters,
      AND: [
        { OR: [{ countryId: input.countryId }, { countryId: null }] },
        { OR: [{ startDate: null }, { startDate: { lte: now } }] },
        { OR: [{ endDate: null }, { endDate: { gte: now } }] },
      ],
    },
    orderBy: { createdAt: "desc" },
  });
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
      include: { currency: true },
    });
    if (price) return price;
  }

  return null;
}

async function resolvePricingContext(input: ResolvePriceInput): Promise<ResolvedPricingContext> {
  const role = await resolveCustomerRoleFromCustomer(input.customerId);
  if (!input.customerId) {
    return {
      role,
      tierId: null,
      tierEligibleForCountry: false,
    };
  }

  const customer = await prisma.customer.findUnique({
    where: { id: input.customerId, deletedAt: null },
    select: { tierId: true },
  });

  if (!customer?.tierId) {
    return {
      role,
      tierId: null,
      tierEligibleForCountry: false,
    };
  }

  const tier = await prisma.tier.findUnique({
    where: { id: customer.tierId },
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
  const activeTaxRules = (await (prisma as unknown as { taxRule: { findMany: (args: unknown) => Promise<ActiveTaxRule[]> } }).taxRule.findMany({
    where: { countryId: input.countryId, status: "ACTIVE" },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  })) as ActiveTaxRule[];

  if (activeTaxRules.length) {
    for (const rule of activeTaxRules) {
      const taxPercent = money(rule.percentage);
      const taxAmount = roundMoney(priceBeforeTax * (taxPercent / 100));
      totalTaxAmount = roundMoney(totalTaxAmount + taxAmount);
      layers.push({
        type: "TAX",
        label: `${rule.name} (${taxPercent}%)`,
        amountBefore: priceBeforeTax,
        amountAfter: roundMoney(priceBeforeTax + totalTaxAmount),
        taxPercent,
        taxAmount,
        taxRuleType: rule.type,
        ruleId: rule.id,
      });
    }
    currentPrice = roundMoney(priceBeforeTax + totalTaxAmount);
  } else if (money(basePrice.taxPercentage) > 0) {
    const taxPercent = money(basePrice.taxPercentage);
    totalTaxAmount = roundMoney(priceBeforeTax * (taxPercent / 100));
    currentPrice = roundMoney(priceBeforeTax + totalTaxAmount);
    layers.push({
      type: "TAX",
      label: `Tax (${taxPercent}%)`,
      amountBefore: priceBeforeTax,
      amountAfter: currentPrice,
      taxPercent,
      taxAmount: totalTaxAmount,
      taxRuleType: "LEGACY_PRODUCT_PRICE_TAX",
    });
  }

  return {
    basePrice: money(basePrice.sellingPrice),
    appliedDiscounts: layers,
    priceBeforeTax,
    taxAmount: roundMoney(totalTaxAmount),
    finalPrice: roundMoney(currentPrice),
    currency: {
      id: basePrice.currency.id,
      code: basePrice.currency.code,
      symbol: basePrice.currency.symbol,
    },
  };
}
type DiscountRuleKind = "TIER" | "MOQ" | "PROMOTIONAL";
