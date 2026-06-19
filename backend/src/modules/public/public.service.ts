import { prisma } from "../../config/database";
import { AppError, getPagination, slugify } from "../../utils/apiResponse";
import { sendQuoteNotification, sendContactNotification } from "../../utils/email";

// ─── Products ─────────────────────────────────────────────

export async function publicListProducts(query: {
  page?: string;
  limit?: string;
  category?: string;   // category slug
  search?: string;
  featured?: string;
  sort?: string;       // "newest" | "name_asc" | "name_desc"
}) {
  const { page, limit, skip } = getPagination(query);

  const where = {
    status: "ACTIVE" as const,
    deletedAt: null as null,
    ...(query.category && {
      category: { slug: query.category },
    }),
    ...(query.search && {
      OR: [
        { title: { contains: query.search, mode: "insensitive" as const } },
        { productCode: { contains: query.search, mode: "insensitive" as const } },
        { shortDescription: { contains: query.search, mode: "insensitive" as const } },
      ],
    }),
    ...(query.featured === "true" && { isFeatured: true }),
  };

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
        category: { select: { id: true, name: true, slug: true } },
        media: { where: { type: "IMAGE" }, orderBy: { sortOrder: "asc" }, take: 3 },
        prices: {
          where: { status: "ACTIVE" },
          include: { country: true, currency: true },
          take: 5,
        },
        _count: { select: { variants: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);

  return { data: products.map(toPublicProduct), total, page, limit };
}

export async function publicGetProduct(slug: string) {
  const product = await prisma.product.findFirst({
    where: { slug, status: "ACTIVE", deletedAt: null },
    include: {
      category: true,
      media: { orderBy: { sortOrder: "asc" } },
      attributes: {
        include: {
          attribute: { include: { values: { where: { status: "ACTIVE" }, orderBy: { sortOrder: "asc" } } } },
        },
      },
      variants: {
        where: { status: "ACTIVE" },
        include: {
          attributeValues: { include: { attribute: true, attributeValue: true } },
          prices: { include: { country: true, currency: true } },
          inventory: true,
        },
      },
      prices: {
        where: { status: "ACTIVE" },
        include: { country: true, currency: true },
      },
    },
  });

  if (!product) throw new AppError("Product not found.", 404);
  return toPublicProductDetail(product);
}

// ─── Categories ───────────────────────────────────────────

export async function publicListCategories() {
  const cats = await prisma.category.findMany({
    where: { status: "ACTIVE", deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { products: { where: { status: "ACTIVE", deletedAt: null } } } },
    },
  });
  return cats.map(toPublicCategory);
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

  const subtotal = input.items.reduce((sum, i) => sum + (i.unitPrice || 0) * i.quantity, 0);
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
        create: input.items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          title: i.productTitle,
          sku: i.sku,
          quantity: i.quantity,
          unitPrice: i.unitPrice || 0,
          total: (i.unitPrice || 0) * i.quantity,
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
    items: input.items.map((i) => ({
      productTitle: i.productTitle,
      sku: i.sku,
      quantity: i.quantity,
      unitPrice: i.unitPrice || 0,
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

export async function publicSearch(query: string) {
  if (!query || query.length < 2) return { products: [], categories: [] };

  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where: {
        status: "ACTIVE",
        deletedAt: null,
        OR: [
          { title: { contains: query, mode: "insensitive" } },
          { productCode: { contains: query, mode: "insensitive" } },
          { shortDescription: { contains: query, mode: "insensitive" } },
        ],
      },
      take: 8,
      include: { media: { take: 1 }, category: { select: { name: true, slug: true } } },
    }),
    prisma.category.findMany({
      where: { status: "ACTIVE", deletedAt: null, name: { contains: query, mode: "insensitive" } },
      take: 4,
    }),
  ]);

  return { products: products.map(toPublicProduct), categories };
}

// ─── Currency / country detection ────────────────────────

export async function getPublicCurrencies() {
  return prisma.currency.findMany({ where: { status: "ACTIVE" }, orderBy: { code: "asc" } });
}

export async function getPublicCountries() {
  return prisma.country.findMany({
    where: { status: "ACTIVE" },
    include: { currency: true },
    orderBy: { name: "asc" },
  });
}

// ─── Inventory availability check ────────────────────────

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

type PrismaProduct = Awaited<ReturnType<typeof prisma.product.findFirst>> & {
  category?: { name: string; slug: string } | null;
  media?: { url: string; altText: string | null; type: string }[];
  prices?: { mrp: number | string; sellingPrice: number | string; country: { code: string; name: string }; currency: { code: string; symbol: string } }[];
  _count?: { variants: number };
};

function toPublicProduct(p: NonNullable<PrismaProduct>) {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    productCode: p.productCode,
    brand: p.brand,
    shortDescription: p.shortDescription,
    category: {
      name: p.category?.name ?? "",
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
    })) ?? [],
  };
}

function toPublicProductDetail(p: NonNullable<Awaited<ReturnType<typeof prisma.product.findFirst>> & {
  category: { name: string; slug: string } | null;
  media: { url: string; altText: string | null; type: string; sortOrder: number }[];
  attributes: {
    attribute: {
      id: string; name: string; slug: string;
      values: { id: string; value: string; slug: string; sortOrder: number }[];
    };
    required: boolean;
  }[];
  variants: {
    id: string; title: string; sku: string | null; variantKey: string; status: string;
    attributeValues: {
      attribute: { id: string; name: string };
      attributeValue: { id: string; value: string };
    }[];
    prices: {
      mrp: number | string; sellingPrice: number | string;
      country: { code: string; name: string };
      currency: { code: string; symbol: string };
    }[];
    inventory: { stock: number; reservedStock: number; status: string } | null;
  }[];
  prices: {
    mrp: number | string; sellingPrice: number | string; dealerPrice: number | string | null;
    country: { code: string; name: string };
    currency: { code: string; symbol: string };
  }[];
}>) {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    productCode: p.productCode,
    brand: p.brand,
    shortDescription: p.shortDescription,
    description: p.description,
    category: {
      name: p.category?.name ?? "",
      slug: p.category?.slug ?? "",
    },
    images: p.media.filter((m) => m.type === "IMAGE").map((m) => ({ url: m.url, alt: m.altText ?? p.title })),
    documents: p.media.filter((m) => m.type === "PDF").map((m) => ({ url: m.url, label: m.altText ?? "Document" })),
    isFeatured: p.isFeatured,
    hasVariants: p.hasVariants,
    seoTitle: p.seoTitle,
    seoDescription: p.seoDescription,
    seoKeywords: p.seoKeywords,
    attributes: p.attributes.map((pa) => ({
      id: pa.attribute.id,
      name: pa.attribute.name,
      slug: pa.attribute.slug,
      required: pa.required,
      values: pa.attribute.values,
    })),
    variants: p.variants.map((v) => ({
      id: v.id,
      title: v.title,
      sku: v.sku,
      variantKey: v.variantKey,
      attributeCombination: v.attributeValues.reduce<Record<string, string>>((acc, av) => {
        acc[av.attribute.name] = av.attributeValue.value;
        return acc;
      }, {}),
      prices: v.prices.map((pr) => ({
        countryCode: pr.country.code,
        currencyCode: pr.currency.code,
        currencySymbol: pr.currency.symbol,
        mrp: Number(pr.mrp),
        sellingPrice: Number(pr.sellingPrice),
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
      dealerPrice: pr.dealerPrice ? Number(pr.dealerPrice) : null,
    })),
  };
}

function toPublicCategory(c: { id: string; name: string; slug: string; description: string | null; image: string | null; _count: { products: number } }) {
  return {
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    image: c.image,
    productCount: c._count.products,
  };
}
