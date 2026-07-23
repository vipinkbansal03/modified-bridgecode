import { prisma } from "../../config/database";
import { AppError, getPagination } from "../../utils/apiResponse";
import { assertActiveCountry, assertSellableInCountry } from "../countries/countryAvailability.service";
import { resolvePrice } from "../pricing/priceResolver.service";
import { sendQuoteConvertedEmail } from "../../utils/email";

export async function listQuotes(query: { page?: string; limit?: string; status?: string; search?: string; sortBy?: string; sortDir?: string }) {
  const { page, limit, skip } = getPagination(query);
  const where: Record<string, unknown> = {};
  if (query.status) where.status = query.status as never;
  if (query.search?.trim()) {
    const search = query.search.trim();
    where.OR = [
      { quoteNumber: { contains: search, mode: "insensitive" } },
      { customerName: { contains: search, mode: "insensitive" } },
      { customerEmail: { contains: search, mode: "insensitive" } },
      { companyName: { contains: search, mode: "insensitive" } },
    ];
  }
  const sortDir = query.sortDir === "asc" ? "asc" : "desc";
  const orderBy = (() => {
    switch (query.sortBy) {
      case "quoteNumber":
        return [{ quoteNumber: sortDir }, { createdAt: "desc" }];
      case "customerName":
        return [{ customerName: sortDir }, { createdAt: "desc" }];
      case "total":
        return [{ total: sortDir }, { createdAt: "desc" }];
      case "status":
        return [{ status: sortDir }, { createdAt: "desc" }];
      case "updatedAt":
        return [{ updatedAt: sortDir }, { createdAt: "desc" }];
      case "country":
        return [{ country: { code: sortDir } }, { createdAt: "desc" }];
      case "createdAt":
      default:
        return [{ createdAt: sortDir }];
    }
  })();
  const [data, total] = await Promise.all([
    prisma.quote.findMany({ where: where as never, skip, take: limit, orderBy: orderBy as never, include: { country: true, currency: true, items: true, _count: { select: { items: true } } } }),
    prisma.quote.count({ where }),
  ]);
  return { data, total, page, limit };
}

function generateQuoteNumber() {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `QUO-${Date.now()}-${suffix}`;
}

export async function getQuote(id: string) {
  const q = await prisma.quote.findUnique({ where: { id }, include: { items: { include: { product: true, variant: true } }, country: true, currency: true, internalNotes: { include: { user: { select: { name: true } } } } } });
  if (!q) throw new AppError("Quote not found.", 404);
  return q;
}

export async function createAdminQuote(input: {
  customerId?: string | null;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string | null;
  companyName?: string | null;
  countryId?: string | null;
  notes?: string | null;
  discount?: number | string | null;
  shippingCharge?: number | string | null;
  items: { productId: string; variantId?: string | null; quantity: number | string; overridePrice?: number | string | null }[];
}) {
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new AppError("Add at least one quote item.", 400);
  }

  const customer = input.customerId
    ? await prisma.customer.findUnique({
        where: { id: input.customerId, deletedAt: null },
        include: { defaultCountry: true },
      })
    : null;
  if (input.customerId && !customer) {
    throw new AppError("Customer not found.", 404);
  }

  const productIds = [...new Set(input.items.map((item) => item.productId))];
  const variantIds = [...new Set(input.items.map((item) => item.variantId).filter(Boolean) as string[])];
  const [products, variants] = await Promise.all([
    prisma.product.findMany({ where: { id: { in: productIds }, deletedAt: null } }),
    prisma.productVariant.findMany({ where: { id: { in: variantIds } } }),
  ]);
  if (products.length !== productIds.length) throw new AppError("One or more products were not found.", 400);
  if (variants.length !== variantIds.length) throw new AppError("One or more variants were not found.", 400);

  const productMap = new Map(products.map((product) => [product.id, product]));
  const variantMap = new Map(variants.map((variant) => [variant.id, variant]));
  for (const variant of variants) {
    if (!productIds.includes(variant.productId)) {
      throw new AppError("A selected variant does not belong to the selected product.", 400);
    }
  }

  const fallbackCountryId = input.countryId || customer?.defaultCountryId || products[0]?.defaultCountryId;
  if (!fallbackCountryId) throw new AppError("Country is required for quote pricing.", 400);
  const country = await assertActiveCountry(fallbackCountryId);

  const quoteItems = await Promise.all(input.items.map(async (item) => {
    const product = productMap.get(item.productId);
    if (!product) throw new AppError("Product not found.", 400);

    const variant = item.variantId ? variantMap.get(item.variantId) : null;
    if (item.variantId && !variant) throw new AppError("Variant not found.", 400);
    if (variant && variant.productId !== product.id) throw new AppError("Variant does not belong to product.", 400);

    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new AppError("Quote item quantity must be at least 1.", 400);
    }

    await assertSellableInCountry({
      countryId: country.id,
      productId: product.id,
      variantId: variant?.id ?? null,
    });

    const overridePrice = item.overridePrice === undefined || item.overridePrice === null || item.overridePrice === ""
      ? null
      : Number(item.overridePrice);
    if (overridePrice !== null && (!Number.isFinite(overridePrice) || overridePrice < 0)) {
      throw new AppError("Override price must be a non-negative number.", 400);
    }

    const resolvedPrice = overridePrice !== null
      ? null
      : await resolvePrice({
          productId: product.id,
          variantId: variant?.id ?? null,
          countryId: country.id,
          customerId: customer?.id ?? null,
          quantity,
        });

    const unitPrice = overridePrice ?? resolvedPrice!.finalPrice;

    return {
      product,
      variant,
      quantity,
      unitPrice,
      total: unitPrice * quantity,
    };
  }));

  const subtotal = quoteItems.reduce((sum, item) => sum + item.total, 0);
  const shippingCharge = input.shippingCharge === undefined || input.shippingCharge === null || input.shippingCharge === ""
    ? 0
    : Number(input.shippingCharge);
  const discount = input.discount === undefined || input.discount === null || input.discount === ""
    ? 0
    : Number(input.discount);

  if (!Number.isFinite(shippingCharge) || shippingCharge < 0) throw new AppError("Shipping charge must be a non-negative number.", 400);
  if (!Number.isFinite(discount) || discount < 0) throw new AppError("Discount must be a non-negative number.", 400);

  const customerName = customer ? `${customer.firstName} ${customer.lastName}`.trim() : input.customerName?.trim();
  const customerEmail = customer?.email ?? input.customerEmail?.trim();
  if (!customerName || !customerEmail) throw new AppError("Customer name and email are required.", 400);

  const quote = await prisma.quote.create({
    data: {
      quoteNumber: generateQuoteNumber(),
      customerId: customer?.id ?? null,
      customerName,
      customerEmail,
      customerPhone: customer?.phone ?? input.customerPhone ?? null,
      companyName: customer?.companyName ?? input.companyName ?? null,
      countryId: country.id,
      currencyId: country.currencyId,
      subtotal,
      discount,
      shippingCharge,
      total: Math.max(0, subtotal + shippingCharge - discount),
      status: "PENDING",
      notes: input.notes ?? null,
      items: {
        create: quoteItems.map((item) => ({
          productId: item.product.id,
          variantId: item.variant?.id ?? null,
          title: item.variant?.title ?? item.product.title,
          sku: item.variant?.sku ?? item.product.sku,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
        })),
      },
    },
  });

  return getQuote(quote.id);
}

export async function updateStatus(id: string, status: string) {
  const quote = await prisma.quote.findUnique({
    where: { id },
    select: { status: true, convertedOrderId: true },
  });
  if (!quote) throw new AppError("Quote not found.", 404);
  if (quote.status === "CONVERTED" || quote.convertedOrderId) {
    throw new AppError("Converted quotes cannot be moved to another status.", 400);
  }

  return prisma.quote.update({ where: { id }, data: { status: status as never } });
}

export const addNote = (quoteId: string, userId: string, note: string) =>
  prisma.quoteNote.create({ data: { quoteId, userId, note } });

export async function updateQuoteReview(
  id: string,
  data: {
    items?: { id: string; quantity: number | string; unitPrice: number | string }[];
    discount?: number | string | null;
    shippingCharge?: number | string | null;
    notes?: string | null;
  }
) {
  const quote = await getQuote(id);
  if (quote.status === "CONVERTED" || quote.convertedOrderId) throw new AppError("Converted quotes cannot be edited.", 400);

  const discount = data.discount === undefined || data.discount === null || data.discount === "" ? Number(quote.discount) : Number(data.discount);
  const shippingCharge = data.shippingCharge === undefined || data.shippingCharge === null || data.shippingCharge === "" ? Number(quote.shippingCharge) : Number(data.shippingCharge);
  if (!Number.isFinite(discount) || discount < 0) throw new AppError("Discount must be a non-negative number.", 400);
  if (!Number.isFinite(shippingCharge) || shippingCharge < 0) throw new AppError("Shipping charge must be a non-negative number.", 400);

  const itemUpdates = data.items ?? quote.items.map((item) => ({ id: item.id, quantity: item.quantity, unitPrice: Number(item.unitPrice) }));
  const quoteItemIds = new Set(quote.items.map((item) => item.id));
  if (itemUpdates.some((item) => !quoteItemIds.has(item.id))) throw new AppError("One or more quote items do not belong to this quote.", 400);

  const normalizedItems = itemUpdates.map((item) => {
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);
    if (!Number.isInteger(quantity) || quantity < 1) throw new AppError("Quote item quantity must be at least 1.", 400);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new AppError("Quote item price must be a non-negative number.", 400);
    return { id: item.id, quantity, unitPrice, total: quantity * unitPrice };
  });

  const subtotal = normalizedItems.reduce((sum, item) => sum + item.total, 0);
  const total = Math.max(0, subtotal + shippingCharge - discount);

  await prisma.$transaction([
    ...normalizedItems.map((item) =>
      prisma.quoteItem.update({
        where: { id: item.id },
        data: { quantity: item.quantity, unitPrice: item.unitPrice, total: item.total },
      })
    ),
    prisma.quote.update({
      where: { id },
      data: {
        subtotal,
        discount,
        shippingCharge,
        total,
        notes: data.notes ?? quote.notes,
        status: quote.status === "PENDING" ? "REVIEWING" : quote.status,
      },
    }),
  ]);

  return getQuote(id);
}

export async function convertToOrder(quoteId: string) {
  const quote = await getQuote(quoteId);
  if (quote.status === "CONVERTED" || quote.convertedOrderId) throw new AppError("Quote already converted.", 400);

  const existingOrder = await prisma.order.findFirst({
    where: { fromQuoteId: quote.id },
    select: { id: true },
  });
  if (existingOrder) {
    await prisma.quote.update({
      where: { id: quoteId },
      data: { status: "CONVERTED", convertedOrderId: existingOrder.id },
    });
    throw new AppError("Quote already converted.", 400);
  }

  const orderNumber = `ORD-${Date.now()}`;
  const order = await prisma.order.create({
    data: {
      orderNumber,
      customerId: quote.customerId,
      customerName: quote.customerName,
      customerEmail: quote.customerEmail,
      customerPhone: quote.customerPhone || "",
      companyName: quote.companyName,
      shippingAddress: {},
      countryId: quote.countryId,
      currencyId: quote.currencyId,
      subtotal: quote.subtotal,
      discount: quote.discount,
      shippingCharge: quote.shippingCharge,
      total: quote.total,
      fromQuoteId: quote.id,
      items: { create: quote.items.map(i => ({ productId: i.productId, variantId: i.variantId, title: i.title, sku: i.sku, quantity: i.quantity, unitPrice: i.unitPrice, total: i.total })) },
    },
  });

  await prisma.quote.update({ where: { id: quoteId }, data: { status: "CONVERTED", convertedOrderId: order.id } });
  void sendQuoteConvertedEmail({
    customerEmail: quote.customerEmail,
    customerName: quote.customerName,
    quoteNumber: quote.quoteNumber,
    orderNumber: order.orderNumber,
    total: Number(order.total),
  });
  return order;
}

export const deleteQuote = async (id: string) => {
  await prisma.quoteItem.deleteMany({ where: { quoteId: id } });
  await prisma.quoteNote.deleteMany({ where: { quoteId: id } });
  return prisma.quote.delete({ where: { id } });
};
