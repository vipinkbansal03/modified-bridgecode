import { prisma } from "../../config/database";
import { AppError, getPagination } from "../../utils/apiResponse";
import {
  sendQuoteNotification,
  sendContactNotification,
} from "../../utils/email";
import type { Prisma } from "@prisma/client";
import { TranslationStatus } from "@prisma/client";
import { resolvePrice } from "../pricing/priceResolver.service";
import { assertSellableInCountry } from "../countries/countryAvailability.service";

function approvedProductTranslationInclude(languageCode: string) {
  return {
    translations: {
      where: {
        language: { code: languageCode, isEnabled: true },
        status: TranslationStatus.APPROVED,
      },
      take: 1,
    },
  };
}

function approvedCategoryTranslationInclude(languageCode: string) {
  return {
    translations: {
      where: {
        language: { code: languageCode, isEnabled: true },
        status: TranslationStatus.APPROVED,
      },
      take: 1,
    },
  };
}

function buildStorefrontProductWhere(
  countryId: string,
  extra?: Prisma.ProductWhereInput,
): Prisma.ProductWhereInput {
  const { OR: extraOr, category: extraCategory, ...extraRest } = (extra ??
    {}) as Prisma.ProductWhereInput & { OR?: Prisma.ProductWhereInput[] };
  const andConditions: Prisma.ProductWhereInput[] = [
    {
      OR: [
        { hasVariants: false },
        {
          variants: {
            some: {
              status: "ACTIVE",
              OR: [
                { countries: { some: { countryId, enabled: true } } },
                { countries: { none: {} } },
              ],
            },
          },
        },
      ],
    },
    {
      OR: [
        { countries: { some: { countryId, enabled: true } } },
        { countries: { none: {} } },
      ],
    },
  ];

  if (extraOr) {
    andConditions.push({ OR: extraOr });
  }

  const categoryWhere: Prisma.CategoryWhereInput = {
    status: "ACTIVE",
    deletedAt: null,
    OR: [
      { countries: { some: { countryId, enabled: true } } },
      { countries: { none: {} } },
    ],
    ...(extraCategory ? (extraCategory as Prisma.CategoryWhereInput) : {}),
  };

  return {
    status: "ACTIVE",
    deletedAt: null,
    category: categoryWhere,
    ...extraRest,
    AND: andConditions,
  };
}

// ─── Products ─────────────────────────────────────────────

export async function publicListProducts(
  query: {
    page?: string;
    limit?: string;
    category?: string; // category slug
    search?: string;
    featured?: string;
    attributeValues?: string; // comma-separated attribute values
    sort?: string; // "newest" | "name_asc" | "name_desc"
    countryCode?: string;
    ids?: string; // comma-separated IDs
  },
  languageCode?: string,
) {
  const { page, limit, skip } = getPagination(query);
  const country = await resolvePublicCountry(query.countryCode);
  if (!country) {
    return { data: [], total: 0, page, limit };
  }

  const selectedAttributeValues = (query.attributeValues ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const filterIds = (query.ids ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);

  const where: Prisma.ProductWhereInput = buildStorefrontProductWhere(
    country.id,
    {
      ...(filterIds.length > 0 && {
        id: { in: filterIds },
      }),
      ...(query.category && {
        category: { slug: query.category },
      }),
      ...(query.search && {
        OR: buildProductTextSearchOr(query.search, languageCode),
      }),
      ...(query.featured === "true" && {
        isFeatured: true,
      }),
      ...(selectedAttributeValues.length > 0 && {
        variants: {
          some: {
            status: "ACTIVE",
            OR: [
              { countries: { some: { countryId: country.id, enabled: true } } },
              { countries: { none: {} } },
            ],
            attributeValues: {
              some: {
                attributeValue: {
                  value: {
                    in: selectedAttributeValues,
                  },
                  status: "ACTIVE",
                },
              },
            },
          },
        },
      }),
    },
  );

  const orderBy =
    query.sort === "name_asc"
      ? { title: "asc" as const }
      : query.sort === "name_desc"
        ? { title: "desc" as const }
        : { createdAt: "desc" as const };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            ...(languageCode && {
              translations:
                approvedCategoryTranslationInclude(languageCode).translations,
            }),
          },
        },
        media: {
          where: { type: "IMAGE" },
          orderBy: { sortOrder: "asc" },
          take: 3,
        },
        ...(languageCode
          ? approvedProductTranslationInclude(languageCode)
          : {}),
        prices: {
          where: { status: "ACTIVE", countryId: country.id },
          include: { country: true, currency: true },
          take: 5,
        },
        variants: {
          where: {
            status: "ACTIVE",
            OR: [
              { countries: { some: { countryId: country.id, enabled: true } } },
              { countries: { none: {} } },
            ],
          },
          include: {
            prices: {
              where: { status: "ACTIVE", countryId: country.id },
              include: { country: true, currency: true },
            },
          },
        },
        _count: {
          select: {
            variants: {
              where: {
                status: "ACTIVE",
                OR: [
                  { countries: { some: { countryId: country.id, enabled: true } } },
                  { countries: { none: {} } },
                ],
              },
            },
          },
        },
      },
    }),
    prisma.product.count({ where }),
  ]);

  return { data: products.map(toPublicProduct), total, page, limit };
}

export async function publicListProductFacets(countryCode?: string) {
  const country = await resolvePublicCountry(countryCode);
  if (!country) return [];

  const rows = await prisma.productVariantAttributeValue.findMany({
    where: {
      attributeValue: { status: "ACTIVE" },
      variant: {
        status: "ACTIVE",
        OR: [
          { countries: { some: { countryId: country.id, enabled: true } } },
          { countries: { none: {} } },
        ],
        product: buildStorefrontProductWhere(country.id),
      },
    },
    select: {
      attribute: { select: { name: true, sortOrder: true } },
      attributeValue: { select: { value: true, sortOrder: true } },
    },
  });

  const seen = new Set<string>();
  const facets: Array<{ attributeName: string; value: string }> = [];
  for (const row of rows.sort(
    (a, b) =>
      a.attribute.sortOrder - b.attribute.sortOrder ||
      a.attribute.name.localeCompare(b.attribute.name) ||
      a.attributeValue.sortOrder - b.attributeValue.sortOrder ||
      a.attributeValue.value.localeCompare(b.attributeValue.value),
  )) {
    const key = `${row.attribute.name}::${row.attributeValue.value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    facets.push({
      attributeName: row.attribute.name,
      value: row.attributeValue.value,
    });
  }
  return facets;
}

export async function publicGetProduct(
  slug: string,
  languageCode?: string,
  countryCode?: string,
) {
  const country = await resolvePublicCountry(countryCode);
  if (!country) throw new AppError("Product not found.", 404);

  const product = await prisma.product.findFirst({
    where: buildStorefrontProductWhere(country.id, { slug }),
    include: {
      category: languageCode
        ? {
            include: approvedCategoryTranslationInclude(languageCode),
          }
        : true,
      media: { orderBy: { sortOrder: "asc" } },
      ...(languageCode ? approvedProductTranslationInclude(languageCode) : {}),
      packages: { where: { status: "ACTIVE" }, orderBy: { sortOrder: "asc" } },
      attributes: {
        include: {
          attribute: {
            include: {
              values: {
                where: { status: "ACTIVE" },
                orderBy: { sortOrder: "asc" },
              },
            },
          },
          allowedValues: {
            where: { attributeValue: { status: "ACTIVE" } },
            include: { attributeValue: true },
            orderBy: { attributeValue: { sortOrder: "asc" } },
          },
        },
      },
      variants: {
        where: {
          status: "ACTIVE",
          OR: [
            { countries: { some: { countryId: country.id, enabled: true } } },
            { countries: { none: {} } },
          ],
        },
        include: {
          package: true,
          attributeValues: {
            include: { attribute: true, attributeValue: true },
          },
          prices: {
            where: {
              status: "ACTIVE",
              countryId: country.id,
            },
            include: { country: true, currency: true },
          },
          inventories: {
            where: {
              OR: [
                { countryId: country.id },
                { countryId: null },
                { warehouse: { countryId: country.id } },
                { warehouseId: null },
              ],
            },
            orderBy: [{ countryId: "desc" }],
          },
        },
      },
      prices: {
        where: {
          status: "ACTIVE",
          variantId: null,
          countryId: country.id,
        },
        include: { country: true, currency: true },
      },
      inventories: {
        where: {
          variantId: null,
          OR: [
            { countryId: country.id },
            { countryId: null },
            { warehouse: { countryId: country.id } },
            { warehouseId: null },
          ],
        },
        orderBy: [{ countryId: "desc" }],
      },
      moqPricing: {
        where: { countryId: country.id, variantId: null },
        orderBy: { minQuantity: "asc" },
      },
      tierPricing: {
        where: { countryId: country.id, variantId: null },
        include: { tier: true },
      },
    },
  });

  if (!product) throw new AppError("Product not found.", 404);

  const now = new Date();
  const startOfCurrentDay = new Date(now);
  startOfCurrentDay.setUTCHours(0, 0, 0, 0);

  const productCollections = await prisma.product.findUnique({
    where: { id: product.id },
    select: { collections: { select: { collectionId: true } } },
  });
  const collectionIds = productCollections?.collections.map((c) => c.collectionId) ?? [];

  const scopeFilters: Prisma.DiscountWhereInput[] = [
    { products: { some: { productId: product.id } } },
    { products: { none: {} }, collections: { none: {} }, categories: { none: {} } },
  ];
  if (collectionIds.length) {
    scopeFilters.push({ collections: { some: { collectionId: { in: collectionIds } } } });
  }
  if (product.categoryId) {
    scopeFilters.push({ categories: { some: { categoryId: product.categoryId } } });
  }

  const promoDiscounts = await prisma.discount.findMany({
    where: {
      type: { in: ["TIER", "MOQ"] },
      status: "ACTIVE",
      OR: scopeFilters,
      AND: [
        { OR: [{ countries: { some: { countryId: country.id } } }, { countries: { none: {} } }] },
        { OR: [{ startDate: null }, { startDate: { lte: now } }] },
        { OR: [{ endDate: null }, { endDate: { gte: startOfCurrentDay } }] },
      ],
    },
    include: {
      tier: true,
    },
  });

  const baseMoqPricing = product.moqPricing.map((m) => ({
    id: m.id,
    minQuantity: m.minQuantity,
    maxQuantity: m.maxQuantity,
    discountPercent: m.discountPercent != null ? Number(m.discountPercent) : null,
    fixedPrice: m.fixedPrice != null ? Number(m.fixedPrice) : null,
  }));

  const promoMoqPricing = promoDiscounts
    .filter((d) => d.type === "MOQ")
    .map((d) => ({
      id: d.id,
      minQuantity: d.minQuantity || 1,
      maxQuantity: d.maxQuantity || null,
      discountPercent: d.discountPercent != null ? Number(d.discountPercent) : null,
      fixedPrice: d.fixedAmount != null ? Number(d.fixedAmount) : null,
    }));

  const allMoqPricing = [...baseMoqPricing, ...promoMoqPricing];
  const moqGroups: Record<string, typeof allMoqPricing> = {};
  for (const mp of allMoqPricing) {
    const key = `${mp.minQuantity}_${mp.maxQuantity ?? "null"}`;
    if (!moqGroups[key]) moqGroups[key] = [];
    moqGroups[key].push(mp);
  }
  const finalMoqPricing = Object.values(moqGroups).map((group) => {
    return group.sort((a, b) => {
      const aPct = a.discountPercent ?? 0;
      const bPct = b.discountPercent ?? 0;
      if (bPct !== aPct) return bPct - aPct;
      const aFixed = a.fixedPrice ?? Infinity;
      const bFixed = b.fixedPrice ?? Infinity;
      return aFixed - bFixed;
    })[0];
  }).sort((a, b) => a.minQuantity - b.minQuantity);

  const baseTierPricing = product.tierPricing.map((t) => ({
    id: t.id,
    tier: { id: t.tier?.id ?? "", name: t.tier?.name ?? "" },
    discountPercent: t.discountPercent != null ? Number(t.discountPercent) : null,
    fixedPrice: t.fixedPrice != null ? Number(t.fixedPrice) : null,
  }));

  const promoTierPricing = promoDiscounts
    .filter((d) => d.type === "TIER" && d.tier)
    .map((d) => ({
      id: d.id,
      tier: { id: d.tier!.id, name: d.tier!.name },
      discountPercent: d.discountPercent != null ? Number(d.discountPercent) : null,
      fixedPrice: d.fixedAmount != null ? Number(d.fixedAmount) : null,
    }));

  const allTierPricing = [...baseTierPricing, ...promoTierPricing];
  const tierGroups: Record<string, typeof allTierPricing> = {};
  for (const tp of allTierPricing) {
    const key = tp.tier?.id ?? "default";
    if (!tierGroups[key]) tierGroups[key] = [];
    tierGroups[key].push(tp);
  }
  const finalTierPricing = Object.values(tierGroups).map((group) => {
    return group.sort((a, b) => {
      const aPct = a.discountPercent ?? 0;
      const bPct = b.discountPercent ?? 0;
      if (bPct !== aPct) return bPct - aPct;
      const aFixed = a.fixedPrice ?? Infinity;
      const bFixed = b.fixedPrice ?? Infinity;
      return aFixed - bFixed;
    })[0];
  });

  const mergedProduct = {
    ...product,
    moqPricing: finalMoqPricing,
    tierPricing: finalTierPricing,
  };

  return toPublicProductDetail(mergedProduct as any, country.id);
}

export async function previewPublicProductPrices(
  slug: string,
  items: { variantId: string; quantity: number }[],
  countryCode?: string,
  customerId?: string | null,
) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError(
      "At least one variant quantity is required for price preview.",
      400,
    );
  }

  const country = await resolvePublicCountry(countryCode);
  if (!country) throw new AppError("Product not found.", 404);

  const product = await prisma.product.findFirst({
    where: buildStorefrontProductWhere(country.id, { slug }),
    select: { id: true, hasVariants: true },
  });

  if (!product) throw new AppError("Product not found.", 404);

  // Validate variant selection compatibility with product variant configuration
  for (const item of items) {
    const isBaseProductRequest = item.variantId === product.id;
    if (product.hasVariants && isBaseProductRequest) {
      throw new AppError(
        "One or more requested variants are not available for this product or country.",
        400,
      );
    }
    if (!product.hasVariants && !isBaseProductRequest) {
      throw new AppError(
        "One or more requested variants are not available for this product or country.",
        400,
      );
    }
  }

  const processedItems = items.map(item => ({
    ...item,
    actualVariantId: item.variantId === product.id ? null : item.variantId
  }));

  const requestedVariantIds = Array.from(
    new Set(processedItems.map((item) => item.actualVariantId).filter(Boolean) as string[]),
  );
  const variants = requestedVariantIds.length > 0
    ? await prisma.productVariant.findMany({
        where: {
          id: { in: requestedVariantIds },
          productId: product.id,
          status: "ACTIVE",
          OR: [
            { countries: { some: { countryId: country.id, enabled: true } } },
            { countries: { none: {} } },
          ],
        },
        select: { id: true, productId: true },
      })
    : [];

  const variantById = new Map(variants.map((variant) => [variant.id, variant]));

  const results = await Promise.all(
    processedItems.map(async (item) => {
      if (!Number.isInteger(item.quantity) || item.quantity < 1) {
        return null;
      }

      if (product.hasVariants && (!item.actualVariantId || !variantById.has(item.actualVariantId))) {
        return null;
      }

      const variant = item.actualVariantId ? variantById.get(item.actualVariantId) : null;

      try {
        await assertSellableInCountry({
          countryId: country.id,
          productId: product.id,
          variantId: variant?.id ?? null,
        });

        const resolved = await resolvePrice({
          productId: product.id,
          variantId: variant?.id ?? null,
          countryId: country.id,
          customerId: customerId ?? undefined,
          quantity: item.quantity,
        });

        if (resolved.finalPrice <= 0 || resolved.basePrice <= 0) {
          return null;
        }

        return {
          variantId: item.variantId,
          quantity: item.quantity,
          unitPrice: resolved.finalPrice,
          basePrice: resolved.basePrice,
          priceBeforeTax: resolved.priceBeforeTax,
          taxAmount: resolved.taxAmount,
          currency: resolved.currency,
          appliedDiscounts: resolved.appliedDiscounts,
          landedCost: resolved.landedCost,
        };
      } catch {
        return null;
      }
    }),
  );

  return results.filter(Boolean);
}

// ─── Categories ───────────────────────────────────────────

export async function publicListCategories(
  languageCode?: string,
  countryCode?: string,
) {
  const country = await resolvePublicCountry(countryCode);
  if (!country) return [];

  const cats = await prisma.category.findMany({
    where: {
      status: "ACTIVE",
      deletedAt: null,
      OR: [
        { countries: { some: { countryId: country.id, enabled: true } } },
        { countries: { none: {} } },
      ],
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      ...(languageCode ? approvedCategoryTranslationInclude(languageCode) : {}),
      _count: {
        select: {
          products: {
            where: buildStorefrontProductWhere(country.id),
          },
        },
      },
    },
  });
  return cats.map(toPublicCategory);
}

export async function publicGetCategory(
  slug: string,
  languageCode?: string,
  countryCode?: string,
) {
  const country = await resolvePublicCountry(countryCode);
  if (!country) throw new AppError("Category not found.", 404);

  const category = await prisma.category.findFirst({
    where: {
      slug,
      status: "ACTIVE",
      deletedAt: null,
      OR: [
        { countries: { some: { countryId: country.id, enabled: true } } },
        { countries: { none: {} } },
      ],
    },
    include: {
      ...(languageCode ? approvedCategoryTranslationInclude(languageCode) : {}),
      _count: {
        select: {
          products: {
            where: {
              ...buildStorefrontProductWhere(country.id),
            },
          },
        },
      },
    },
  });
  if (!category) throw new AppError("Category not found.", 404);
  return toPublicCategory(category);
}

export async function getPublicLanguages() {
  return prisma.language.findMany({
    where: { isEnabled: true },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    select: { id: true, name: true, code: true, isDefault: true },
  });
}

export async function getPublicStaticTranslations(languageCode?: string) {
  if (!languageCode) return {};

  const language = await prisma.language.findFirst({
    where: { code: languageCode, isEnabled: true },
    select: { id: true },
  });
  if (!language) return {};

  const rows = await prisma.translationKeyword.findMany({
    where: {
      languageId: language.id,
      key: { startsWith: "ui." },
    },
    select: { key: true, value: true },
  });

  return rows.reduce<Record<string, string>>((acc, row) => {
    if (row.value) acc[row.key] = row.value;
    return acc;
  }, {});
}

// ─── Quote submit ─────────────────────────────────────────

export interface QuoteSubmitInput {
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  companyName?: string;
  countryCode?: string;
  customerId?: string | null;
  items: {
    productId: string;
    variantId?: string;
    productTitle: string;
    sku?: string;
    quantity: number;
    unitPrice?: number;
  }[];
  message?: string;
}

const QUOTE_VOLUME_TIERS = [
  { minValue: 50000, percentage: 15 },
  { minValue: 25000, percentage: 10 },
] as const;

function quoteVolumeDiscountPercent(subtotal: number) {
  for (const tier of QUOTE_VOLUME_TIERS) {
    if (subtotal >= tier.minValue) return tier.percentage;
  }
  return 0;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function getSubmittedUnitPrice(value: unknown) {
  const price = Number(value);
  return Number.isFinite(price) && price > 0 ? price : null;
}

export async function submitPublicQuote(input: QuoteSubmitInput) {
  const country = input.countryCode
    ? await prisma.country.findFirst({
        where: { code: input.countryCode },
        include: { currency: true },
      })
    : await prisma.country.findFirst({
        where: { isDefault: true },
        include: { currency: true },
      });

  const defaultCountry = country || {
    id: "default",
    currencyId: "default",
    currency: { symbol: "$" },
  };
  const resolvedItems = await Promise.all(
    input.items.map(async (item) => {
      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) {
        throw new AppError("Quote item quantity must be at least 1.", 400);
      }

      let resolved = null;
      if (item.productId && item.variantId && defaultCountry.id !== "default") {
        try {
          resolved = await resolvePrice({
            productId: item.productId,
            variantId: item.variantId,
            countryId: defaultCountry.id,
            customerId: input.customerId ?? undefined,
            quantity,
          });
        } catch {
          resolved = null;
        }
      }

      const submittedUnitPrice = getSubmittedUnitPrice(item.unitPrice);
      const unitPrice = submittedUnitPrice ?? resolved?.finalPrice ?? 0;
      return {
        ...item,
        quantity,
        unitPrice,
        total: roundMoney(unitPrice * quantity),
      };
    }),
  );

  const subtotal = roundMoney(
    resolvedItems.reduce((sum, item) => sum + item.total, 0),
  );
  const discountPercent = quoteVolumeDiscountPercent(subtotal);
  const discount = roundMoney((subtotal * discountPercent) / 100);
  const total = roundMoney(Math.max(0, subtotal - discount));
  const quoteNumber = `QUO-${Date.now()}`;

  const quote = await prisma.quote.create({
    data: {
      quoteNumber,
      customerName: input.customerName,
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone,
      companyName: input.companyName,
      countryId: defaultCountry.id,
      currencyId: defaultCountry.currencyId,
      subtotal,
      discount,
      total,
      notes: input.message,
      items: {
        create: resolvedItems.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          title: i.productTitle,
          sku: i.sku,
          quantity: i.quantity,
          unitPrice: i.unitPrice || 0,
          total: i.total,
        })),
      },
    },
    include: { items: true },
  });

  void sendQuoteNotification({
    quoteNumber,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    customerPhone: input.customerPhone,
    companyName: input.companyName,
    items: resolvedItems.map((i) => ({
      productTitle: i.productTitle,
      sku: i.sku,
      quantity: i.quantity,
      unitPrice: i.unitPrice,
    })),
    subtotal,
    discount,
    discountPercent,
    total,
    notes: input.message,
  });

  // Notify Admins
  import("../notifications/notifications.service").then(({ notificationsService }) => {
    notificationsService.createNotification({
      title: "New Quote Request",
      message: `Quote #${quote.quoteNumber} has been requested by ${quote.customerName}.`,
      type: "INFO",
      targetType: "ALL_ADMINS",
      link: `/admin/quotes/${quote.id}`,
    }).catch(console.error);
  });

  return quote;
}

// ─── Contact form ─────────────────────────────────────────

export interface ContactInput {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  country?: string;
  subject?: string;
  message: string;
  type?: "general" | "dealer" | "distributor" | "oem";
}

export async function submitContact(input: ContactInput) {
  // Log as an activity so admin can see it
  await prisma.activityLog.create({
    data: {
      action: "CONTACT_FORM_SUBMITTED",
      entityType: "Contact",
      metadata: input as never,
    },
  });

  await prisma.contactSubmission.create({
    data: {
      name: input.name,
      email: input.email,
      phone: input.phone || null,
      company: input.company || null,
      subject: input.subject || null,
      type: input.type || null,
      message: input.message,
    },
  });

  void sendContactNotification(input);

  return {
    success: true,
    message: "Your message has been received. We'll respond within 24 hours.",
  };
}

// ─── Search ───────────────────────────────────────────────

function buildProductTextSearchOr(
  query: string,
  languageCode?: string,
): Prisma.ProductWhereInput[] {
  const textMatch = { contains: query, mode: "insensitive" as const };
  const matches: Prisma.ProductWhereInput[] = [
    { title: textMatch },
    { productCode: textMatch },
    { shortDescription: textMatch },
  ];

  if (languageCode) {
    matches.push({
      translations: {
        some: {
          status: TranslationStatus.APPROVED,
          language: { code: languageCode, isEnabled: true },
          OR: [
            { title: textMatch },
            { shortDescription: textMatch },
            { description: textMatch },
          ],
        },
      },
    });
  }

  return matches;
}

function buildCategoryTextSearchOr(
  query: string,
  languageCode?: string,
): Prisma.CategoryWhereInput[] {
  const textMatch = { contains: query, mode: "insensitive" as const };
  const matches: Prisma.CategoryWhereInput[] = [
    { name: textMatch },
    { description: textMatch },
  ];

  if (languageCode) {
    matches.push({
      translations: {
        some: {
          status: TranslationStatus.APPROVED,
          language: { code: languageCode, isEnabled: true },
          OR: [{ name: textMatch }, { description: textMatch }],
        },
      },
    });
  }

  return matches;
}

export async function publicSearch(
  query: string,
  languageCode?: string,
  countryCode?: string,
) {
  if (!query || query.length < 2) return { products: [], categories: [] };
  const country = await resolvePublicCountry(countryCode);
  if (!country) return { products: [], categories: [] };

  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where: buildStorefrontProductWhere(country.id, {
        OR: buildProductTextSearchOr(query, languageCode),
      }),
      take: 8,
      include: {
        media: { take: 1 },
        ...(languageCode
          ? approvedProductTranslationInclude(languageCode)
          : {}),
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            ...(languageCode && {
              translations:
                approvedCategoryTranslationInclude(languageCode).translations,
            }),
          },
        },
        prices: {
          where: { status: "ACTIVE", countryId: country.id },
          include: { country: true, currency: true },
        },
        variants: {
          where: {
            status: "ACTIVE",
            OR: [
              { countries: { some: { countryId: country.id, enabled: true } } },
              { countries: { none: {} } },
            ],
          },
          include: {
            prices: {
              where: { status: "ACTIVE", countryId: country.id },
              include: { country: true, currency: true },
            },
          },
        },
      },
    }),
    prisma.category.findMany({
      where: {
        status: "ACTIVE",
        deletedAt: null,
        AND: [
          {
            OR: [
              { countries: { some: { countryId: country.id, enabled: true } } },
              { countries: { none: {} } },
            ],
          },
          {
            OR: buildCategoryTextSearchOr(query, languageCode),
          },
        ],
      },
      take: 4,
      include: {
        ...(languageCode
          ? approvedCategoryTranslationInclude(languageCode)
          : {}),
        _count: {
          select: {
            products: {
              where: buildStorefrontProductWhere(country.id),
            },
          },
        },
      },
    }),
  ]);

  return {
    products: products.map(toPublicProduct),
    categories: categories.map(toPublicCategory),
  };
}

// ─── Currency / country detection ────────────────────────

export async function getPublicCurrencies() {
  return prisma.currency.findMany({
    where: { status: "ACTIVE" },
    orderBy: { code: "asc" },
  });
}

export async function getPublicCountries() {
  return prisma.country.findMany({
    where: {
      status: "ACTIVE",
    },
    include: { currency: true },
    orderBy: { name: "asc" },
  });
}

// ─── Inventory availability check ────────────────────────

async function resolvePublicCountry(countryCode?: string): Promise<{ id: string; code: string } | null> {
  const normalizedCode = countryCode?.trim().toUpperCase();

  if (normalizedCode) {
    return prisma.country.findFirst({
      where: {
        code: normalizedCode,
        status: "ACTIVE",
      },
      select: { id: true, code: true },
    });
  }

  const defaultCountry = await prisma.country.findFirst({
    where: {
      isDefault: true,
      status: "ACTIVE",
    },
    select: { id: true, code: true },
  });

  if (defaultCountry) return defaultCountry;

  return prisma.country.findFirst({
    where: {
      status: "ACTIVE",
    },
    orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, code: true },
  });
}

export async function checkInventory(
  variantIds: string[],
  countryCode?: string,
) {
  const requestedCountry = countryCode
    ? await resolvePublicCountry(countryCode)
    : null;
  const records = await prisma.inventory.findMany({
    where: {
      OR: [
        { variantId: { in: variantIds } },
        { productId: { in: variantIds }, variantId: null },
      ],
      ...(requestedCountry
        ? {
            OR: [
              { countryId: requestedCountry.id },
              { countryId: null },
              { warehouse: { countryId: requestedCountry.id } },
              { warehouseId: null },
            ],
          }
        : {}),
    },
    select: {
      variantId: true,
      productId: true,
      countryId: true,
      stock: true,
      reservedStock: true,
      status: true,
      variant: {
        select: {
          id: true,
          title: true,
          sku: true,
          product: {
            select: {
              title: true,
            },
          },
        },
      },
      product: {
        select: {
          id: true,
          title: true,
          productCode: true,
        },
      },
    },
    orderBy: [{ countryId: "desc" }],
  });

  const variantStockMap = new Map<string, {
    variantId: string;
    totalStock: number;
    totalReserved: number;
    hasInStock: boolean;
    productTitle: string;
    variantTitle: string;
    sku: string | null;
  }>();

  for (const record of records) {
    const key = record.variantId || record.productId;
    if (!key) continue;

    const available = Math.max(0, record.stock - record.reservedStock);
    const existing = variantStockMap.get(key);
    if (!existing) {
      variantStockMap.set(key, {
        variantId: key,
        totalStock: record.stock,
        totalReserved: record.reservedStock,
        hasInStock: record.status === "IN_STOCK" || available > 0,
        productTitle: record.variant?.product?.title ?? record.product?.title ?? "",
        variantTitle: record.variant?.title ?? "",
        sku: record.variant?.sku ?? record.product?.productCode ?? null,
      });
    } else {
      existing.totalStock += record.stock;
      existing.totalReserved += record.reservedStock;
      if (record.status === "IN_STOCK" || available > 0) {
        existing.hasInStock = true;
      }
    }
  }

  return Array.from(variantStockMap.values()).map((r) => {
    const available = Math.max(0, r.totalStock - r.totalReserved);
    return {
      variantId: r.variantId,
      available,
      status: available > 0 ? (r.hasInStock ? "IN_STOCK" : "LOW_STOCK") : "OUT_OF_STOCK",
      productTitle: r.productTitle,
      variantTitle: r.variantTitle,
      sku: r.sku,
    };
  });
}

// ─── Shape mappers ────────────────────────────────────────

type ProductTranslationSnapshot = {
  title: string | null;
  shortDescription: string | null;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords?: string | null;
  highlights?: Prisma.JsonValue | null;
  technicalSpecs?: Prisma.JsonValue | null;
  warranty?: Prisma.JsonValue | null;
  primaryFeatures?: Prisma.JsonValue | null;
};

type CategoryTranslationSnapshot = {
  name: string | null;
  description: string | null;
};

type CategoryTextSource = {
  name: string;
  description?: string | null;
  translations?: CategoryTranslationSnapshot[];
};

function getCategoryText(category?: CategoryTextSource | null) {
  const translation = category?.translations?.[0];

  return {
    name: translation?.name || category?.name || "",
    description: translation?.description || category?.description || null,
  };
}

type ProductTextSource = {
  title: string;
  shortDescription: string | null;
  description?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoKeywords?: string | null;
  highlights?: Prisma.JsonValue | null;
  technicalSpecs?: Prisma.JsonValue | null;
  warranty?: Prisma.JsonValue | null;
  primaryFeatures?: Prisma.JsonValue | null;
  translations?: Array<Record<string, unknown>>;
};

function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function getProductText(product: ProductTextSource) {
  const translation = product.translations?.[0] as ProductTranslationSnapshot | undefined;

  return {
    title: translation?.title || product.title,
    shortDescription: translation?.shortDescription || product.shortDescription,
    description: translation?.description || product.description || null,
    seoTitle: translation?.seoTitle || product.seoTitle || null,
    seoDescription:
      translation?.seoDescription || product.seoDescription || null,
    seoKeywords: translation?.seoKeywords || product.seoKeywords || null,
    highlights: asArray<{ title: string; description: string }>(translation?.highlights ?? product.highlights),
    technicalSpecs: (translation?.technicalSpecs ?? product.technicalSpecs) ?? [],
    warranty: asArray<string>(translation?.warranty ?? product.warranty),
    primaryFeatures: asArray<{ title: string; description: string }>(translation?.primaryFeatures ?? product.primaryFeatures),
  };
}

type PriceRecord = {
  mrp: Prisma.Decimal | number;
  sellingPrice: Prisma.Decimal | number;
  dealerPrice?: Prisma.Decimal | number | null;
  distributorPrice?: Prisma.Decimal | number | null;
  country: { code: string; name: string; dutyPercentage?: Prisma.Decimal | number };
  currency: { code: string; symbol: string };
  taxMode?: string;
};

type PublicProductRecord = {
  id: string;
  slug: string;
  title: string;
  productCode: string | null;
  brand: string;
  shortDescription: string | null;
  informationImage?: string | null;
  informationDescription?: string | null;
  category: CategoryTextSource & { id?: string; slug: string };
  media: Array<{ type: string; url: string; altText?: string | null }>;
  isFeatured: boolean;
  hasVariants: boolean;
  prices?: PriceRecord[];
  variants?: Array<{ prices?: PriceRecord[] }>;
  _count?: { variants: number };
  translations?: Array<Record<string, unknown>>;
};

function toPriceDto(pr: PriceRecord) {
  return {
    countryCode: pr.country.code,
    countryName: pr.country.name,
    currencyCode: pr.currency.code,
    currencySymbol: pr.currency.symbol,
    mrp: Number(pr.mrp),
    sellingPrice: Number(pr.sellingPrice),
    dealerPrice: pr.dealerPrice != null ? Number(pr.dealerPrice) : null,
    doctorRetailerPrice:
      pr.distributorPrice != null ? Number(pr.distributorPrice) : null,
    distributorPrice:
      pr.distributorPrice != null ? Number(pr.distributorPrice) : null,
    taxMode: pr.taxMode,
    landedCost: buildPublicPriceBreakdown({ country: pr.country, mrp: pr.mrp }),
  };
}

function computeLowestVariantPrices(
  productPrices: PriceRecord[],
  allVariantPrices: PriceRecord[][],
) {
  const variantPricesFlat = allVariantPrices.flat();
  const candidates =
    variantPricesFlat.length > 0 ? variantPricesFlat : productPrices;
  if (!candidates.length) return [];

  const byCurrency = new Map<string, PriceRecord[]>();
  for (const pr of candidates) {
    const key = pr.currency.code;
    const arr = byCurrency.get(key);
    if (arr) arr.push(pr);
    else byCurrency.set(key, [pr]);
  }

  return Array.from(byCurrency.values()).map((entries) => {
    const cheapest = entries.reduce((min, cur) =>
      Number(cur.sellingPrice) < Number(min.sellingPrice) ? cur : min,
    );
    return toPriceDto(cheapest);
  });
}

function toPublicProduct(p: PublicProductRecord) {
  const text = getProductText(p);
  const categoryText = getCategoryText(p.category);

  const allVariantPrices = (p.variants ?? []).map(
    (v) => (v.prices ?? []) as PriceRecord[],
  );
  const lowestPrices = computeLowestVariantPrices(
    (p.prices ?? []) as PriceRecord[],
    allVariantPrices,
  );

  const hasCountryPrice = lowestPrices.length > 0 || (p.prices?.length ?? 0) > 0;
  const pricingStatus: "AVAILABLE" | "PRICE_ON_REQUEST" | "UNAVAILABLE" = hasCountryPrice
    ? "AVAILABLE"
    : "PRICE_ON_REQUEST";

  return {
    id: p.id,
    slug: p.slug,
    title: text.title,
    productCode: p.productCode,
    brand: p.brand,
    shortDescription: text.shortDescription,
    informationImage: p.informationImage,
    informationDescription: p.informationDescription,
    category: {
      name: categoryText.name,
      slug: p.category?.slug ?? "",
    },
    images: p.media?.filter((m) => m.type === "IMAGE").map((m) => m.url) ?? [],
    thumbnail: p.media?.[0]?.url ?? null,
    isFeatured: p.isFeatured,
    hasVariants: p.hasVariants,
    variantCount: p._count?.variants ?? 0,
    prices: lowestPrices.length > 0
      ? lowestPrices
      : (p.prices?.map((pr) => toPriceDto(pr)) ?? []),
  };
}

type PublicProductDetailRecord = {
  id: string;
  slug: string;
  title: string;
  productCode: string | null;
  brand: string;
  shortDescription: string | null;
  informationImage?: string | null;
  informationDescription?: string | null;
  description?: string | null;
  category: CategoryTextSource & { id?: string; slug: string };
  media: Array<{ type: string; url: string; altText?: string | null }>;
  packages: Array<{ id: string; title: string; slug: string; image: string | null; description: string | null; sortOrder: number }>;
  attributes: Array<{
    id?: string;
    required?: boolean;
    gridAxis?: string | null;
    sortOrder?: number;
    attribute: {
      id?: string;
      name: string;
      role?: string;
      status?: string;
      sortOrder: number;
      values: Array<{
        id: string;
        attributeId?: string;
        value: string;
        slug: string;
        sortOrder: number;
        image?: string | null;
        note?: string | null;
        priceAdjustment?: Prisma.Decimal | number;
        gridRole?: string | null;
        countryId?: string | null;
        moq?: number | null;
        tierPrice?: Prisma.Decimal | number | null;
        dealerPrice?: Prisma.Decimal | number | null;
      }>;
    };
    allowedValues: Array<{
      attributeValueId: string;
      attributeValue: {
        id: string;
        attributeId?: string;
        value: string;
        slug: string;
        sortOrder: number;
        image?: string | null;
        note?: string | null;
        priceAdjustment?: Prisma.Decimal | number;
        gridRole?: string | null;
        countryId?: string | null;
        moq?: number | null;
        tierPrice?: Prisma.Decimal | number | null;
        dealerPrice?: Prisma.Decimal | number | null;
      };
    }>;
  }>;
  variants: Array<{
    id: string;
    title: string;
    sku: string | null;
    variantKey: string;
    moq?: number | null;
    package: { id: string; title: string; slug?: string } | null;
    attributeValues: Array<{
      attributeId: string;
      attributeValueId: string;
      attribute: { name: string };
      attributeValue: { id: string; value: string };
    }>;
    prices: Array<{
    country: { code: string; name: string; dutyPercentage?: Prisma.Decimal | number };
      currency: { code: string; symbol: string };
      mrp: Prisma.Decimal | number;
      sellingPrice: Prisma.Decimal | number;
      dealerPrice?: Prisma.Decimal | number | null;
      distributorPrice?: Prisma.Decimal | number | null;
    }>;
    inventories: Array<{ countryId: string | null; warehouseId: string | null; stock: number; reservedStock: number; status: string }>;
  }>;
  prices: Array<{
    country: { code: string; name: string };
    currency: { code: string; symbol: string };
    mrp: Prisma.Decimal | number;
    sellingPrice: Prisma.Decimal | number;
    dealerPrice?: Prisma.Decimal | number | null;
    distributorPrice?: Prisma.Decimal | number | null;
  }>;
  isFeatured: boolean;
  hasVariants: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoKeywords?: string | null;
  highlights?: Prisma.JsonValue | null;
  technicalSpecs?: Prisma.JsonValue | null;
  warranty?: Prisma.JsonValue | null;
  primaryFeatures?: Prisma.JsonValue | null;
  additionalInfo?: Prisma.JsonValue | null;
  _count?: { variants: number };
  moqPricing?: Array<{
    id: string;
    minQuantity: number;
    maxQuantity: number | null;
    discountPercent: Prisma.Decimal | number | null;
    fixedPrice: Prisma.Decimal | number | null;
  }>;
  tierPricing?: Array<{
    id: string;
    tier: { id: string; name: string };
    discountPercent: Prisma.Decimal | number | null;
    fixedPrice: Prisma.Decimal | number | null;
  }>;
  translations?: ProductTranslationSnapshot[];
};

function buildPublicPriceBreakdown(pr: {
  country?: { code?: string; dutyPercentage?: Prisma.Decimal | number | null } | null;
  mrp: Prisma.Decimal | number;
}) {
  const dutyPercentage = Number(pr?.country?.dutyPercentage) || 0;
  if (dutyPercentage <= 0) return undefined;
  const mrp = Number(pr.mrp);
  return {
    dutyPercentage,
    dutyAmount: Math.round((mrp * dutyPercentage) / (100 + dutyPercentage) * 100) / 100,
  };
}

async function toPublicProductDetail(
  p: PublicProductDetailRecord,
  countryId?: string,
) {
  const text = getProductText(p);
  const categoryText = getCategoryText(p.category);

  const activeTaxRules = countryId
    ? await (prisma as any).taxRule.findMany({
        where: { countries: { some: { countryId } }, status: "ACTIVE" },
        include: {
          products: { select: { id: true } },
          categories: { select: { id: true } },
          variants: { select: { id: true } },
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      })
    : [];

  const productSpecificRules = activeTaxRules.filter((rule: any) =>
    rule.products.some((prod: any) => prod.id === p.id),
  );

  const categorySpecificRules = p.category?.id
    ? activeTaxRules.filter((rule: any) =>
        rule.categories.some((c: any) => c.id === p.category?.id),
      )
    : [];

  const globalCountryRules = activeTaxRules.filter(
    (r: any) =>
      r.products.length === 0 &&
      r.categories.length === 0 &&
      r.variants.length === 0,
  );

  const activeRules =
    productSpecificRules.length > 0
      ? productSpecificRules
      : categorySpecificRules.length > 0
      ? categorySpecificRules
      : globalCountryRules;

  let resolvedTaxMode = "EXCLUSIVE";
  if (activeRules.length > 0) {
    resolvedTaxMode = activeRules[0].taxMode || "EXCLUSIVE";
  } else {
    console.warn(
      `No tax rules (product-specific or global) found for product ${p.id} in country ${countryId}. Defaulting to INCLUSIVE.`,
    );
    resolvedTaxMode = "INCLUSIVE";
  }

  const productPrices = p.prices.map((pr) => ({
    countryCode: pr.country?.code ?? "",
    countryName: pr.country?.name ?? "",
    currencyCode: pr.currency?.code ?? "",
    currencySymbol: pr.currency?.symbol ?? "",
    mrp: Number(pr.mrp),
    sellingPrice: Number(pr.sellingPrice),
    dealerPrice: pr.dealerPrice != null ? Number(pr.dealerPrice) : null,
    doctorRetailerPrice:
      pr.distributorPrice != null ? Number(pr.distributorPrice) : null,
    distributorPrice:
      pr.distributorPrice != null ? Number(pr.distributorPrice) : null,
    taxMode: resolvedTaxMode,
    landedCost: buildPublicPriceBreakdown(pr),
  }));

  const baseAvailable = (p as any).inventories?.reduce(
    (sum: number, inv: any) => sum + Math.max(0, (inv.stock ?? 0) - (inv.reservedStock ?? 0)),
    0
  ) ?? 0;
  
  const baseInventory = (p as any).inventories?.length ? {
    available: baseAvailable,
    status: baseAvailable > 0 ? "IN_STOCK" : "OUT_OF_STOCK",
  } : null;

  const baseWarehouseInventories = (p as any).inventories?.map((inv: any) => ({
    warehouseId: inv.warehouseId,
    available: Math.max(0, (inv.stock ?? 0) - (inv.reservedStock ?? 0)),
    status: inv.status ?? "OUT_OF_STOCK",
  })).filter((inv: any) => inv.available > 0) ?? [];

  const publicVariants = p.hasVariants
    ? p.variants.map((v) => {
    const variantPrices = v.prices.map((pr) => ({
      countryCode: pr.country?.code ?? "",
      countryName: pr.country?.name ?? "",
      currencyCode: pr.currency?.code ?? "",
      currencySymbol: pr.currency?.symbol ?? "",
      mrp: Number(pr.mrp),
      sellingPrice: Number(pr.sellingPrice),
      dealerPrice: pr.dealerPrice != null ? Number(pr.dealerPrice) : null,
      doctorRetailerPrice:
        pr.distributorPrice != null ? Number(pr.distributorPrice) : null,
      distributorPrice:
        pr.distributorPrice != null ? Number(pr.distributorPrice) : null,
      taxMode: resolvedTaxMode,
      landedCost: buildPublicPriceBreakdown(pr),
    }));

    const totalVariantAvailable = v.inventories.reduce(
      (sum, inv) => sum + Math.max(0, (inv.stock ?? 0) - (inv.reservedStock ?? 0)),
      0
    );

    const variantInventory = v.inventories.length > 0 ? {
      available: totalVariantAvailable,
      status: totalVariantAvailable > 0 ? "IN_STOCK" : "OUT_OF_STOCK",
    } : null;

    return {
      id: v.id,
      title: v.title,
      sku: v.sku,
      variantKey: v.variantKey,
      moq: v.moq,
      package: v.package
        ? {
            id: v.package.id,
            title: v.package.title,
            slug: v.package.slug,
          }
        : null,
      attributeValueIdsByAttributeId: v.attributeValues.reduce<
        Record<string, string>
      >((acc, av) => {
        acc[av.attributeId] = av.attributeValueId;
        return acc;
      }, {}),
      attributeCombination: v.attributeValues.reduce<Record<string, string>>(
        (acc, av) => {
          acc[av.attribute.name] = av.attributeValue.value;
          return acc;
        },
        {},
      ),
      // Fall back to product-level country price when variant has none yet.
      prices: variantPrices.length ? variantPrices : productPrices,
      hasCountryPrice: variantPrices.length > 0 || productPrices.length > 0,
      pricingStatus: (variantPrices.length > 0 || productPrices.length > 0)
        ? "AVAILABLE"
        : "PRICE_ON_REQUEST",
      inventory: variantInventory,
      warehouseInventories: v.inventories.map((inv) => ({
        warehouseId: inv.warehouseId,
        available: Math.max(0, (inv.stock ?? 0) - (inv.reservedStock ?? 0)),
        status: inv.status,
      })).filter((inv) => inv.available > 0),
    };
  })
    : [];

  const highlights = Array.isArray(p.highlights) ? (p.highlights as { title: string; description: string }[]) : [];
  const technicalSpecs = Array.isArray(p.technicalSpecs) ? (p.technicalSpecs as { label: string; value: string }[]) : [];
  const warranty = Array.isArray(p.warranty) ? (p.warranty.filter((line): line is string => typeof line === "string") as string[]) : [];
  const primaryFeatures = Array.isArray(p.primaryFeatures) ? (p.primaryFeatures as { title: string; description: string }[]) : [];

  const variantAttributeNames = new Set(
    publicVariants.flatMap((variant) =>
      Object.keys(variant.attributeCombination),
    ),
  );

  const configuratorAttributes = p.hasVariants
    ? p.attributes
    .map((pa) => {
      const allowedValues = pa.allowedValues
        .map((selection) => selection.attributeValue)
        .sort(
          (a, b) => a.sortOrder - b.sortOrder || a.value.localeCompare(b.value),
        );

      // Only offer values that exist on at least one sellable variant for this country.
      const valuesUsedByVariants = allowedValues.filter((value) =>
        publicVariants.some(
          (variant) =>
            variant.attributeCombination[pa.attribute.name] === value.value,
        ),
      );

      const role =
        pa.gridAxis === "COLUMN"
          ? "X_GRID"
          : pa.gridAxis === "ROW"
            ? "Y_GRID"
            : (pa.attribute.role ?? "DROPDOWN");

      return {
        id: pa.attribute.id,
        name: pa.attribute.name,
        role,
        displayType: role,
        status: pa.attribute.status,
        required: pa.required,
        sortOrder: pa.attribute.sortOrder,
        values: (valuesUsedByVariants.length
          ? valuesUsedByVariants
          : allowedValues
        ).map((value) => ({
          id: value.id,
          attributeId: value.attributeId,
          value: value.value,
          slug: value.slug,
          sortOrder: value.sortOrder,
          image: value.image,
          note: value.note,
          priceAdjustment: Number(value.priceAdjustment),
          gridRole: value.gridRole,
          countryId: value.countryId,
          moq: value.moq,
          tierPrice: value.tierPrice != null ? Number(value.tierPrice) : null,
          dealerPrice:
            value.dealerPrice != null ? Number(value.dealerPrice) : null,
        })),
        allowedValueIds: pa.allowedValues.map(
          (selection) => selection.attributeValueId,
        ),
      };
    })
    .filter((attribute) => {
      // Prefer attributes that actually drive available variants.
      if (variantAttributeNames.size === 0) return true;
      return variantAttributeNames.has(attribute.name);
    })
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    : [];

  return {
    id: p.id,
    slug: p.slug,
    title: text.title,
    productCode: p.productCode,
    brand: p.brand,
    shortDescription: text.shortDescription,
    informationImage: p.informationImage,
    informationDescription: p.informationDescription,
    description: text.description,
    category: {
      id: p.category?.id ?? "",
      name: categoryText.name,
      slug: p.category?.slug ?? "",
    },
    images: p.media
      .filter((m) => m.type === "IMAGE")
      .map((m) => ({ url: m.url, alt: m.altText ?? text.title })),
    documents: p.media
      .filter((m) => m.type === "PDF")
      .map((m) => ({ url: m.url, label: m.altText ?? "Document" })),
    isFeatured: p.isFeatured,
    hasVariants: p.hasVariants,
    seoTitle: text.seoTitle,
    seoDescription: text.seoDescription,
    seoKeywords: text.seoKeywords,
    highlights: text.highlights,
    technicalSpecs: text.technicalSpecs,
    warranty: text.warranty,
    primaryFeatures: text.primaryFeatures,
    additionalInfo: p.additionalInfo,
    packages: p.packages.map((pkg) => ({
      id: pkg.id,
      title: pkg.title,
      slug: pkg.slug,
      image: pkg.image,
      description: pkg.description,
      sortOrder: pkg.sortOrder,
    })),
    attributes: configuratorAttributes,
    variants: publicVariants,
    prices: productPrices,
    inventory: baseInventory,
    warehouseInventories: baseWarehouseInventories,
    hasCountryPrice: productPrices.length > 0 || publicVariants.some((v) => v.hasCountryPrice),
    pricingStatus: (productPrices.length > 0 || publicVariants.some((v) => v.hasCountryPrice))
      ? "AVAILABLE"
      : "PRICE_ON_REQUEST",
    lowestPrice: computeLowestVariantPrices(
      (p.prices ?? []) as unknown as PriceRecord[],
      p.hasVariants ? p.variants.map((v) => (v.prices ?? []) as unknown as PriceRecord[]) : [],
    ),
    moqPricing: (p as any).moqPricing?.map((m: any) => ({
      id: m.id,
      minQuantity: m.minQuantity,
      maxQuantity: m.maxQuantity,
      discountPercent: m.discountPercent != null ? Number(m.discountPercent) : null,
      fixedPrice: m.fixedPrice != null ? Number(m.fixedPrice) : null,
    })) ?? [],
    tierPricing: (p as any).tierPricing?.map((t: any) => ({
      id: t.id,
      tier: { id: t.tier.id, name: t.tier.name },
      discountPercent: t.discountPercent != null ? Number(t.discountPercent) : null,
      fixedPrice: t.fixedPrice != null ? Number(t.fixedPrice) : null,
    })) ?? [],
  };
}

function toPublicCategory(c: {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  translations?: CategoryTranslationSnapshot[];
  _count: { products: number };
}) {
  const text = getCategoryText(c);

  return {
    id: c.id,
    name: text.name,
    slug: c.slug,
    description: text.description,
    image: c.image,
    productCount: c._count.products,
  };
}

export async function getProductReviews(slug: string) {
  const product = await prisma.product.findFirst({
    where: { slug, deletedAt: null },
    select: { id: true },
  });

  if (!product) {
    return { reviews: [], averageRating: 0, totalRatings: 0 };
  }

  const reviews = await (prisma as any).productReview.findMany({
    where: { productId: product.id, status: "APPROVED", deletedAt: null },
    orderBy: { createdAt: "desc" },
  });

  if (!reviews.length) {
    return { reviews: [], averageRating: 0, totalRatings: 0 };
  }

  const sumOverall = reviews.reduce((acc: number, r: any) => acc + (r.ratingOverall || 5), 0);
  const averageRating = Number((sumOverall / reviews.length).toFixed(1));

  return {
    reviews,
    averageRating,
    totalRatings: reviews.length,
  };
}

export async function submitProductReview(
  slug: string,
  data: {
    customerName?: string;
    customerEmail?: string;
    ratingQuality?: number;
    ratingPrice?: number;
    ratingOverall?: number;
    feedbackText?: string;
  }
) {
  const product = await prisma.product.findFirst({
    where: { slug, deletedAt: null },
    select: { id: true },
  });

  if (!product) throw new AppError("Product not found", 404);

  if (data.customerEmail) {
    const existing = await (prisma as any).productReview.findFirst({
      where: { productId: product.id, customerEmail: data.customerEmail, deletedAt: null },
    });
    if (existing) {
      throw new AppError("You have already submitted a review for this product.", 400);
    }
  }

  const review = await (prisma as any).productReview.create({
    data: {
      productId: product.id,
      customerName: data.customerName || "Anonymous",
      customerEmail: data.customerEmail || "",
      ratingQuality: Number(data.ratingQuality || 5),
      ratingPrice: Number(data.ratingPrice || 5),
      ratingOverall: Number(data.ratingOverall || 5),
      feedbackText: data.feedbackText || "",
      status: "PENDING",
    },
  });

  const aggregate = await getProductReviews(slug);

  return {
    review,
    averageRating: aggregate.averageRating,
    totalRatings: aggregate.totalRatings,
  };
}

export async function getProductWarehouses(
  slug: string,
  variantId: string | undefined,
  countryCode: string,
  state: string | undefined
) {
  const product = await prisma.product.findFirst({
    where: { slug, deletedAt: null },
    select: { id: true },
  });
  if (!product) throw new AppError("Product not found", 404);

  const requestCountry = await prisma.country.findUnique({
    where: { code: countryCode }
  });

  const actualVariantId = variantId === product.id ? null : variantId;

  const inventories = await prisma.inventory.findMany({
    where: {
      productId: product.id,
      ...(actualVariantId ? { variantId: actualVariantId } : { variantId: null }),
      stock: { gt: 0 },
      OR: [
        { variantId: null },
        { variant: { status: "ACTIVE" } }
      ]
    },
    include: {
      warehouse: {
        include: {
          country: true
        }
      }
    },
  });

  const validWarehousesMap = new Map<string, any>();

  for (const inv of inventories) {
    if (!inv.warehouseId) {
      if (validWarehousesMap.has("default")) {
        const existing = validWarehousesMap.get("default");
        existing.stock += inv.stock;
      } else {
        validWarehousesMap.set("default", {
          id: "default",
          name: "Default Seller",
          countryId: "",
          countryCode: "",
          countryName: "Global",
          state: null,
          stock: inv.stock,
          estimatedDeliveryDays: "7-14",
          isLocal: false,
          isStateMatch: false
        });
      }
      continue;
    }

    if (!inv.warehouse || inv.warehouse.status !== "ACTIVE") continue;
    const w = inv.warehouse;

    let isEligible = false;
    
    if (!w.deliveryZones || !Array.isArray(w.deliveryZones) || w.deliveryZones.length === 0) {
      isEligible = true; // No zones defined means delivers everywhere
    } else if (requestCountry) {
      const zone = (w.deliveryZones as any[]).find((z: any) => z.countryId === requestCountry.id);
      if (zone) {
        if (!zone.states || zone.states.length === 0) {
           isEligible = true; // Delivers everywhere in this country
        } else if (state && zone.states.includes(state)) {
           isEligible = true; // Delivers to this specific state
        }
      }
    }

    if (isEligible) {
      if (validWarehousesMap.has(w.id)) {
        // Aggregate stock if we're dealing with multiple variants
        const existing = validWarehousesMap.get(w.id);
        existing.stock += inv.stock;
      } else {
        validWarehousesMap.set(w.id, {
          id: w.id,
          name: w.name,
          countryId: w.countryId,
          countryCode: w.country?.code || "",
          countryName: w.country?.name || "",
          state: w.state,
          stock: inv.stock,
          estimatedDeliveryDays: w.country?.code === countryCode ? "2-4" : "7-14",
          isLocal: w.country?.code === countryCode,
          isStateMatch: Boolean(state && w.state && w.state.toLowerCase() === state.toLowerCase())
        });
      }
    }
  }

  const validWarehouses = Array.from(validWarehousesMap.values());

  validWarehouses.sort((a, b) => {
    // 1. Prioritize state match (same state)
    if (a.isStateMatch && !b.isStateMatch) return -1;
    if (!a.isStateMatch && b.isStateMatch) return 1;
    
    // 2. Prioritize country match (same country)
    if (a.isLocal && !b.isLocal) return -1;
    if (!a.isLocal && b.isLocal) return 1;
    
    // 3. Tie-breaker: Highest stock
    return b.stock - a.stock;
  });

  return validWarehouses;
}
