import { prisma } from "../../config/database";
import { AppError, getPagination } from "../../utils/apiResponse";
import { sendQuoteNotification, sendContactNotification } from "../../utils/email";
import type { Prisma } from "@prisma/client";
import { TranslationStatus } from "@prisma/client";
import { resolvePrice } from "../pricing/priceResolver.service";

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

function buildStorefrontProductWhere(countryId: string, extra?: Prisma.ProductWhereInput): Prisma.ProductWhereInput {
  return {
    status: "ACTIVE",
    deletedAt: null,
    countries: { some: { countryId, enabled: true } },
    category: { countries: { some: { countryId, enabled: true } } },
    OR: [
      { hasVariants: false },
      {
        variants: {
          some: {
            status: "ACTIVE",
            countries: { some: { countryId, enabled: true } },
          },
        },
      },
    ],
    ...(extra ?? {}),
  };
}

// ─── Products ─────────────────────────────────────────────

export async function publicListProducts(query: {
  page?: string;
  limit?: string;
  category?: string;   // category slug
  search?: string;
  featured?: string;
  sort?: string;       // "newest" | "name_asc" | "name_desc"
  countryCode?: string;
}, languageCode?: string) {
  const { page, limit, skip } = getPagination(query);
  const country = await resolvePublicCountry(query.countryCode);

  const where: Prisma.ProductWhereInput = buildStorefrontProductWhere(country.id, {
    category: {
      ...(query.category ? { slug: query.category } : {}),
      countries: { some: { countryId: country.id, enabled: true } },
    },
    ...(query.search && {
      OR: buildProductTextSearchOr(query.search, languageCode),
    }),
    ...(query.featured === "true" && { isFeatured: true }),
  });

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
              translations: approvedCategoryTranslationInclude(languageCode).translations,
            }),
          },
        },
        media: { where: { type: "IMAGE" }, orderBy: { sortOrder: "asc" }, take: 3 },
        ...(languageCode ? approvedProductTranslationInclude(languageCode) : {}),
        prices: {
          where: { status: "ACTIVE", countryId: country.id },
          include: { country: true, currency: true },
          take: 5,
        },
        _count: {
          select: {
            variants: {
              where: { status: "ACTIVE", countries: { some: { countryId: country.id, enabled: true } } },
            },
          },
        },
      },
    }),
    prisma.product.count({ where }),
  ]);

  return { data: products.map(toPublicProduct), total, page, limit };
}

export async function publicGetProduct(slug: string, languageCode?: string, countryCode?: string) {
  const country = await resolvePublicCountry(countryCode);
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
          attribute: { include: { values: { where: { status: "ACTIVE" }, orderBy: { sortOrder: "asc" } } } },
          allowedValues: {
            where: { attributeValue: { status: "ACTIVE" } },
            include: { attributeValue: true },
            orderBy: { attributeValue: { sortOrder: "asc" } },
          },
        },
      },
      variants: {
        where: { status: "ACTIVE", countries: { some: { countryId: country.id, enabled: true } } },
        include: {
          package: true,
          attributeValues: { include: { attribute: true, attributeValue: true } },
          prices: { where: { status: "ACTIVE", countryId: country.id }, include: { country: true, currency: true } },
          inventory: true,
        },
      },
      prices: {
        where: { status: "ACTIVE", countryId: country.id },
        include: { country: true, currency: true },
      },
    },
  });

  if (!product || (product.hasVariants && product.variants.length === 0)) throw new AppError("Product not found.", 404);
  return toPublicProductDetail(product);
}

export async function previewPublicProductPrices(
  slug: string,
  items: { variantId: string; quantity: number }[],
  countryCode?: string,
  customerId?: string | null,
) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError("At least one variant quantity is required for price preview.", 400);
  }

  const country = await resolvePublicCountry(countryCode);
  const product = await prisma.product.findFirst({
    where: buildStorefrontProductWhere(country.id, { slug }),
    select: { id: true },
  });

  if (!product) throw new AppError("Product not found.", 404);

  const requestedVariantIds = Array.from(new Set(items.map((item) => item.variantId)));
  const variants = await prisma.productVariant.findMany({
    where: {
      id: { in: requestedVariantIds },
      productId: product.id,
      status: "ACTIVE",
      countries: { some: { countryId: country.id, enabled: true } },
    },
    select: { id: true, productId: true },
  });

  if (variants.length !== requestedVariantIds.length) {
    throw new AppError("One or more requested variants are not available for this product or country.", 400);
  }

  const variantById = new Map(variants.map((variant) => [variant.id, variant]));

  return Promise.all(
    items.map(async (item) => {
      if (!Number.isInteger(item.quantity) || item.quantity < 1) {
        throw new AppError("Preview quantity must be at least 1.", 400);
      }

      const variant = variantById.get(item.variantId);
      if (!variant) throw new AppError("One or more requested variants are unavailable.", 400);

      const resolved = await resolvePrice({
        productId: variant.productId,
        variantId: variant.id,
        countryId: country.id,
        customerId: customerId ?? undefined,
        quantity: item.quantity,
      });

      return {
        variantId: variant.id,
        quantity: item.quantity,
        unitPrice: resolved.finalPrice,
        basePrice: resolved.basePrice,
        priceBeforeTax: resolved.priceBeforeTax,
        taxAmount: resolved.taxAmount,
        currency: resolved.currency,
        appliedDiscounts: resolved.appliedDiscounts,
      };
    }),
  );
}

// ─── Categories ───────────────────────────────────────────

export async function publicListCategories(languageCode?: string, countryCode?: string) {
  const country = await resolvePublicCountry(countryCode);
  const cats = await prisma.category.findMany({
    where: {
      status: "ACTIVE",
      deletedAt: null,
      countries: { some: { countryId: country.id, enabled: true } },
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

export async function publicGetCategory(slug: string, languageCode?: string, countryCode?: string) {
  const country = await resolvePublicCountry(countryCode);
  const category = await prisma.category.findFirst({
    where: {
      slug,
      status: "ACTIVE",
      deletedAt: null,
      countries: { some: { countryId: country.id, enabled: true } },
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

export async function submitPublicQuote(input: QuoteSubmitInput) {
  const country = input.countryCode
    ? await prisma.country.findFirst({ where: { code: input.countryCode }, include: { currency: true } })
    : await prisma.country.findFirst({ where: { isDefault: true }, include: { currency: true } });

  const defaultCountry = country || { id: "default", currencyId: "default", currency: { symbol: "$" } };
  const resolvedItems = await Promise.all(
    input.items.map(async (item) => {
      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) {
        throw new AppError("Quote item quantity must be at least 1.", 400);
      }

      const resolved = item.productId && item.variantId
        ? await resolvePrice({
            productId: item.productId,
            variantId: item.variantId,
            countryId: defaultCountry.id,
            quantity,
          })
        : null;

      const unitPrice = resolved?.finalPrice ?? Number(item.unitPrice || 0);
      return {
        ...item,
        quantity,
        unitPrice,
        total: unitPrice * quantity,
      };
    }),
  );

  const subtotal = resolvedItems.reduce((sum, item) => sum + item.total, 0);
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
      discount: 0,
      total: subtotal,
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
    notes: input.message,
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

  // Also store as a quote with zero items so it shows up in the Quotes module
  const country = await prisma.country.findFirst({ where: { isDefault: true } });
  const currency = await prisma.currency.findFirst({ where: { isBase: true } });

  if (country && currency) {
    await prisma.quote.create({
      data: {
        quoteNumber: `CONTACT-${Date.now()}`,
        customerName: input.name,
        customerEmail: input.email,
        customerPhone: input.phone,
        companyName: input.company,
        countryId: country.id,
        currencyId: currency.id,
        subtotal: 0,
        discount: 0,
        total: 0,
        notes: `[${(input.type || "general").toUpperCase()}] ${input.subject ? input.subject + ": " : ""}${input.message}`,
      },
    });
  }

  void sendContactNotification(input);

  return { success: true, message: "Your message has been received. We'll respond within 24 hours." };
}

// ─── Search ───────────────────────────────────────────────

function buildProductTextSearchOr(query: string, languageCode?: string): Prisma.ProductWhereInput[] {
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

function buildCategoryTextSearchOr(query: string, languageCode?: string): Prisma.CategoryWhereInput[] {
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

export async function publicSearch(query: string, languageCode?: string, countryCode?: string) {
  if (!query || query.length < 2) return { products: [], categories: [] };
  const country = await resolvePublicCountry(countryCode);

  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where: buildStorefrontProductWhere(country.id, {
        OR: buildProductTextSearchOr(query, languageCode),
      }),
      take: 8,
      include: {
        media: { take: 1 },
        ...(languageCode ? approvedProductTranslationInclude(languageCode) : {}),
        category: {
          select: {
            name: true,
            slug: true,
            description: true,
            ...(languageCode && {
              translations: approvedCategoryTranslationInclude(languageCode).translations,
            }),
          },
        },
      },
    }),
    prisma.category.findMany({
      where: {
        status: "ACTIVE",
        deletedAt: null,
        countries: { some: { countryId: country.id, enabled: true } },
        OR: buildCategoryTextSearchOr(query, languageCode),
      },
      take: 4,
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
    }),
  ]);

  return { products: products.map(toPublicProduct), categories: categories.map(toPublicCategory) };
}

// ─── Currency / country detection ────────────────────────

export async function getPublicCurrencies() {
  return prisma.currency.findMany({ where: { status: "ACTIVE" }, orderBy: { code: "asc" } });
}

export async function getPublicCountries() {
  return prisma.country.findMany({
    where: {
      status: "ACTIVE",
      productCountries: {
        some: {
          enabled: true,
          product: {
            status: "ACTIVE",
            deletedAt: null,
          },
        },
      },
    },
    include: { currency: true },
    orderBy: { name: "asc" },
  });
}

// ─── Inventory availability check ────────────────────────

async function resolvePublicCountry(countryCode?: string) {
  const normalizedCode = countryCode?.trim().toUpperCase();
  const country = normalizedCode
    ? await prisma.country.findFirst({
        where: {
          code: normalizedCode,
          status: "ACTIVE",
          productCountries: {
            some: {
              enabled: true,
              product: {
                status: "ACTIVE",
                deletedAt: null,
              },
            },
          },
        },
        select: { id: true, code: true },
      })
    : await prisma.country.findFirst({
        where: {
          isDefault: true,
          status: "ACTIVE",
          productCountries: {
            some: {
              enabled: true,
              product: {
                status: "ACTIVE",
                deletedAt: null,
              },
            },
          },
        },
        select: { id: true, code: true },
      });

  if (country) return country;

  const fallbackCountry = await prisma.country.findFirst({
    where: {
      status: "ACTIVE",
      productCountries: {
        some: {
          enabled: true,
          product: {
            status: "ACTIVE",
            deletedAt: null,
          },
        },
      },
    },
    orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, code: true },
  });

  if (!fallbackCountry) throw new AppError("Selected country is not available.", 400);
  return fallbackCountry;
}

export async function checkInventory(variantIds: string[]) {
  const records = await prisma.inventory.findMany({
    where: { variantId: { in: variantIds } },
    select: { variantId: true, stock: true, reservedStock: true, status: true },
  });
  return records.map((r) => ({
    variantId: r.variantId,
    available: Math.max(0, r.stock - r.reservedStock),
    status: r.status,
  }));
}

// ─── Shape mappers ────────────────────────────────────────

type ProductTranslationSnapshot = {
  title: string | null;
  shortDescription: string | null;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
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

function getCategoryText(category: CategoryTextSource) {
  const translation = category.translations?.[0];

  return {
    name: translation?.name || category.name,
    description: translation?.description || category.description || null,
  };
}

type ProductTextSource = {
  title: string;
  shortDescription: string | null;
  description?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  translations?: ProductTranslationSnapshot[];
};

function getProductText(product: ProductTextSource) {
  const translation = product.translations?.[0];

  return {
    title: translation?.title || product.title,
    shortDescription: translation?.shortDescription || product.shortDescription,
    description: translation?.description || product.description || null,
    seoTitle: translation?.seoTitle || product.seoTitle || null,
    seoDescription: translation?.seoDescription || product.seoDescription || null,
  };
}

type PublicProductRecord = Prisma.ProductGetPayload<{
  include: {
    category: { select: { name: true; slug: true; description: true } };
    media: true;
  };
}> & {
  prices?: Array<{
    mrp: Prisma.Decimal | number;
    sellingPrice: Prisma.Decimal | number;
    dealerPrice?: Prisma.Decimal | number | null;
    distributorPrice?: Prisma.Decimal | number | null;
    country: { code: string; name: string };
    currency: { code: string; symbol: string };
  }>;
  _count?: { variants: number };
  translations?: ProductTranslationSnapshot[];
};

function toPublicProduct(p: PublicProductRecord) {
  const text = getProductText(p);
  const categoryText = getCategoryText(p.category);

  return {
    id: p.id,
    slug: p.slug,
    title: text.title,
    productCode: p.productCode,
    brand: p.brand,
    shortDescription: text.shortDescription,
    category: {
      name: categoryText.name,
      slug: p.category?.slug ?? "",
    },
    images: p.media?.filter((m) => m.type === "IMAGE").map((m) => m.url) ?? [],
    thumbnail: p.media?.[0]?.url ?? null,
    isFeatured: p.isFeatured,
    hasVariants: p.hasVariants,
    variantCount: p._count?.variants ?? 0,
    prices: p.prices?.map((pr) => ({
      countryCode: pr.country.code,
      countryName: pr.country.name,
      currencyCode: pr.currency.code,
      currencySymbol: pr.currency.symbol,
      mrp: Number(pr.mrp),
      sellingPrice: Number(pr.sellingPrice),
      dealerPrice: pr.dealerPrice != null ? Number(pr.dealerPrice) : null,
      doctorRetailerPrice: pr.distributorPrice != null ? Number(pr.distributorPrice) : null,
      distributorPrice: pr.distributorPrice != null ? Number(pr.distributorPrice) : null,
    })) ?? [],
  };
}

type PublicProductDetailRecord = Prisma.ProductGetPayload<{
  include: {
    category: true;
    media: true;
    packages: true;
    attributes: {
      include: {
        attribute: { include: { values: true } };
        allowedValues: { include: { attributeValue: true } };
      };
    };
    variants: {
      include: {
        package: true;
        attributeValues: { include: { attribute: true; attributeValue: true } };
        prices: { include: { country: true; currency: true } };
        inventory: true;
      };
    };
    prices: { include: { country: true; currency: true } };
  };
}> & {
  translations?: ProductTranslationSnapshot[];
};

function toPublicProductDetail(p: PublicProductDetailRecord) {
  const text = getProductText(p);
  const categoryText = getCategoryText(p.category);

  return {
    id: p.id,
    slug: p.slug,
    title: text.title,
    productCode: p.productCode,
    brand: p.brand,
    shortDescription: text.shortDescription,
    description: text.description,
    category: {
      name: categoryText.name,
      slug: p.category?.slug ?? "",
    },
    images: p.media.filter((m) => m.type === "IMAGE").map((m) => ({ url: m.url, alt: m.altText ?? text.title })),
    documents: p.media.filter((m) => m.type === "PDF").map((m) => ({ url: m.url, label: m.altText ?? "Document" })),
    isFeatured: p.isFeatured,
    hasVariants: p.hasVariants,
    seoTitle: text.seoTitle,
    seoDescription: text.seoDescription,
    seoKeywords: p.seoKeywords,
    packages: p.packages.map((pkg) => ({
      id: pkg.id,
      title: pkg.title,
      slug: pkg.slug,
      image: pkg.image,
      description: pkg.description,
      sortOrder: pkg.sortOrder,
    })),
    attributes: p.attributes
      .map((pa) => {
        const allowedValues = pa.allowedValues
          .map((selection) => selection.attributeValue)
          .sort((a, b) => a.sortOrder - b.sortOrder || a.value.localeCompare(b.value));

        return {
          id: pa.attribute.id,
          name: pa.attribute.name,
          role: pa.attribute.role,
          displayType: pa.attribute.role,
          status: pa.attribute.status,
          required: pa.required,
          sortOrder: pa.attribute.sortOrder,
          values: allowedValues.map((value) => ({
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
            dealerPrice: value.dealerPrice != null ? Number(value.dealerPrice) : null,
          })),
          allowedValueIds: pa.allowedValues.map((selection) => selection.attributeValueId),
        };
      })
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    variants: p.variants.map((v) => ({
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
      attributeValueIdsByAttributeId: v.attributeValues.reduce<Record<string, string>>((acc, av) => {
        acc[av.attributeId] = av.attributeValueId;
        return acc;
      }, {}),
      attributeCombination: v.attributeValues.reduce<Record<string, string>>((acc, av) => {
        acc[av.attribute.name] = av.attributeValue.value;
        return acc;
      }, {}),
      prices: v.prices.map((pr) => ({
        countryCode: pr.country.code,
        countryName: pr.country.name,
        currencyCode: pr.currency.code,
        currencySymbol: pr.currency.symbol,
        mrp: Number(pr.mrp),
        sellingPrice: Number(pr.sellingPrice),
        dealerPrice: pr.dealerPrice != null ? Number(pr.dealerPrice) : null,
        doctorRetailerPrice: pr.distributorPrice != null ? Number(pr.distributorPrice) : null,
        distributorPrice: pr.distributorPrice != null ? Number(pr.distributorPrice) : null,
      })),
      inventory: v.inventory
        ? {
            available: Math.max(0, v.inventory.stock - v.inventory.reservedStock),
            status: v.inventory.status,
          }
        : null,
    })),
    prices: p.prices.map((pr) => ({
      countryCode: pr.country.code,
      countryName: pr.country.name,
      currencyCode: pr.currency.code,
      currencySymbol: pr.currency.symbol,
      mrp: Number(pr.mrp),
      sellingPrice: Number(pr.sellingPrice),
      dealerPrice: pr.dealerPrice != null ? Number(pr.dealerPrice) : null,
      doctorRetailerPrice: pr.distributorPrice != null ? Number(pr.distributorPrice) : null,
      distributorPrice: pr.distributorPrice != null ? Number(pr.distributorPrice) : null,
    })),
  };
}

function toPublicCategory(c: { id: string; name: string; slug: string; description: string | null; image: string | null; translations?: CategoryTranslationSnapshot[]; _count: { products: number } }) {
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
