import { prisma } from "../../config/database";
import { AppError, getPagination } from "../../utils/apiResponse";
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

export async function getQuote(id: string) {
  const q = await prisma.quote.findUnique({ where: { id }, include: { items: { include: { product: true, variant: true } }, country: true, currency: true, internalNotes: { include: { user: { select: { name: true } } } } } });
  if (!q) throw new AppError("Quote not found.", 404);
  return q;
}

export const updateStatus = (id: string, status: string) => prisma.quote.update({ where: { id }, data: { status: status as never } });

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
  if (quote.status === "CONVERTED") throw new AppError("Converted quotes cannot be edited.", 400);

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
  if (quote.status === "CONVERTED") throw new AppError("Quote already converted.", 400);

  const orderNumber = `ORD-${Date.now()}`;
  const order = await prisma.order.create({
    data: {
      orderNumber,
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
