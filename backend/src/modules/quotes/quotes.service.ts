import { prisma } from "../../config/database";
import { AppError, getPagination } from "../../utils/apiResponse";

export async function listQuotes(query: { page?: string; limit?: string; status?: string }) {
  const { page, limit, skip } = getPagination(query);
  const where = query.status ? { status: query.status as never } : {};
  const [data, total] = await Promise.all([
    prisma.quote.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" }, include: { country: true, currency: true, items: true, _count: { select: { items: true } } } }),
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
      total: quote.total,
      fromQuoteId: quote.id,
      items: { create: quote.items.map(i => ({ productId: i.productId, variantId: i.variantId, title: i.title, sku: i.sku, quantity: i.quantity, unitPrice: i.unitPrice, total: i.total })) },
    },
  });

  await prisma.quote.update({ where: { id: quoteId }, data: { status: "CONVERTED", convertedOrderId: order.id } });
  return order;
}
