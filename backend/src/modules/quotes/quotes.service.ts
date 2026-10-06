import { prisma } from "../../config/database";
import { Prisma } from "@prisma/client";
import { AppError, getPagination } from "../../utils/apiResponse";
import { sanitizeCustomerName, cleanSingleName, isValidCustomerName } from "../../utils/nameValidation";
import { assertActiveCountry, assertSellableInCountry, assertSellableInCountryBatch } from "../countries/countryAvailability.service";
import { resolvePrice, createSharedPricingContext } from "../pricing/priceResolver.service";
import { sendQuoteConvertedEmail, sendQuoteSentEmail } from "../../utils/email";
import { reserveOrderInventory } from "../inventory/inventoryReservation.service";
import { resolveItemFulfillmentWarehouse } from "../warehouse/warehouseResolver.service";
import { generateOrderNumber } from "../orders/orders.service";

export async function listQuotes(query: { page?: string; limit?: string; status?: string; search?: string; sortBy?: string; sortDir?: string; deleted?: string }) {
  const { page, limit, skip } = getPagination(query);
  const where: Record<string, unknown> = {};

  const isDeleted = query.deleted === "true";
  where.deletedAt = isDeleted ? { not: null } : null;

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
      case "deletedAt":
        return [{ deletedAt: sortDir }, { createdAt: "desc" }];
      case "country":
        return [{ country: { code: sortDir } }, { createdAt: "desc" }];
      case "createdAt":
      default:
        return [{ createdAt: sortDir }];
    }
  })();
  const [data, total] = await Promise.all([
    prisma.quote.findMany({ where: where as never, skip, take: limit, orderBy: orderBy as never, include: { country: true, currency: true, items: true, internalNotes: { select: { id: true, note: true }, take: 1 }, _count: { select: { items: true } } } }),
    prisma.quote.count({ where }),
  ]);
  return { data, total, page, limit };
}

function generateQuoteNumber() {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `QUO-${Date.now()}-${suffix}`;
}

export async function getQuote(id: string) {
  const q = await prisma.quote.findUnique({
    where: { id },
    include: {
      items: { include: { product: true, variant: true } },
      country: true,
      currency: true,
      customer: { include: { addresses: true } },
      internalNotes: { include: { user: { select: { name: true } } } },
    },
  });
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
  expiresAt?: string | Date | null;
  shippingAddress?: Record<string, unknown> | null;
  billingAddress?: Record<string, unknown> | null;
  discount?: number | string | null;
  shippingCharge?: number | string | null;
  sendEmail?: boolean;
  status?: string;
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
    : input.customerEmail
    ? await prisma.customer.findFirst({
        where: { email: { equals: input.customerEmail.trim(), mode: "insensitive" }, deletedAt: null },
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

  await assertSellableInCountryBatch({
    countryId: country.id,
    items: input.items.map((item) => ({
      productId: item.productId,
      variantId: item.variantId ?? null,
    })),
  });

  const sharedPricingContext = await createSharedPricingContext({
    countryId: country.id,
    customerId: customer?.id ?? null,
  });

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
          sharedContext: sharedPricingContext,
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

  const customerName = customer
    ? sanitizeCustomerName(customer.firstName, customer.lastName) || customer.email
    : cleanSingleName(input.customerName);
  const customerEmail = customer?.email ?? input.customerEmail?.trim();
  if (!customerName || !customerEmail) throw new AppError("Customer name and email are required.", 400);
  if (!isValidCustomerName(customerName) && !customer) throw new AppError("Please provide a valid customer name (at least 2 letters, no trailing symbols).", 400);

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
      status: input.sendEmail || input.status === "SENT" ? "SENT" : "PENDING",
      source: "ADMIN",
      notes: input.notes ?? null,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      shippingAddress: input.shippingAddress ? (input.shippingAddress as object) : Prisma.DbNull,
      billingAddress: input.billingAddress ? (input.billingAddress as object) : Prisma.DbNull,
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

  if (quote.status === "SENT" || input.sendEmail) {
    void sendQuoteSentEmail({
      customerEmail: quote.customerEmail,
      customerName: quote.customerName,
      quoteNumber: quote.quoteNumber,
      total: Number(quote.total),
    });
  }

  return getQuote(quote.id);
}

export async function updateStatus(id: string, status: string) {
  const quote = await prisma.quote.findUnique({
    where: { id },
    select: { status: true, convertedOrderId: true, customerEmail: true, customerName: true, quoteNumber: true, total: true },
  });
  if (!quote) throw new AppError("Quote not found.", 404);
  if (quote.status === "CONVERTED" || quote.convertedOrderId) {
    throw new AppError("Converted quotes cannot be moved to another status.", 400);
  }

  if (status === "CONVERTED") {
    return convertToOrder(id);
  }

  const updated = await prisma.quote.update({ where: { id }, data: { status: status as never } });

  if (status === "SENT") {
    void sendQuoteSentEmail({
      customerEmail: quote.customerEmail,
      customerName: quote.customerName,
      quoteNumber: quote.quoteNumber,
      total: Number(quote.total),
    });
  }

  return updated;
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
    expiresAt?: string | Date | null;
    shippingAddress?: Record<string, unknown> | null;
    billingAddress?: Record<string, unknown> | null;
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
        expiresAt: data.expiresAt !== undefined ? (data.expiresAt ? new Date(data.expiresAt) : null) : quote.expiresAt,
        shippingAddress: data.shippingAddress !== undefined ? (data.shippingAddress ? (data.shippingAddress as object) : Prisma.DbNull) : quote.shippingAddress ?? Prisma.DbNull,
        billingAddress: data.billingAddress !== undefined ? (data.billingAddress ? (data.billingAddress as object) : Prisma.DbNull) : quote.billingAddress ?? Prisma.DbNull,
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

  const shippingAddressObj = (quote.shippingAddress || {}) as Record<string, any>;
  const destinationState = (shippingAddressObj.state as string) || (quote.customer as any)?.addresses?.[0]?.state || null;
  const destinationCountryCode = quote.country?.code || null;
  const destinationCountryId = quote.countryId;

  // Resolve warehouse for each quote item using standard ranking
  const resolvedItems = await Promise.all(
    quote.items.map(async (i) => {
      const resolvedWarehouse = await resolveItemFulfillmentWarehouse(prisma, {
        productId: i.productId,
        variantId: i.variantId ?? null,
        quantity: i.quantity,
        explicitWarehouseId: undefined, // auto-resolve using quote destination
        destinationState,
        destinationCountryCode,
        destinationCountryId,
      });

      return {
        ...i,
        warehouseId: resolvedWarehouse.warehouseId,
      };
    })
  );

  const orderNumber = generateOrderNumber();

  let customerId = quote.customerId;
  if (!customerId && quote.customerEmail) {
    const matchedCustomer = await prisma.customer.findFirst({
      where: { email: { equals: quote.customerEmail, mode: "insensitive" }, deletedAt: null },
      select: { id: true },
    });
    if (matchedCustomer) customerId = matchedCustomer.id;
  }

  const order = await prisma.$transaction(async (tx) => {
    const createdOrder = await tx.order.create({
      data: {
        orderNumber,
        customerId,
        customerName: quote.customerName,
        customerEmail: quote.customerEmail,
        customerPhone: quote.customerPhone || "",
        companyName: quote.companyName,
        shippingAddress: (quote.shippingAddress as never) ?? {},
        countryId: quote.countryId,
        currencyId: quote.currencyId,
        subtotal: quote.subtotal,
        discount: quote.discount,
        shippingCharge: quote.shippingCharge,
        total: quote.total,
        fromQuoteId: quote.id,
        items: {
          create: resolvedItems.map((i) => ({
            productId: i.productId,
            variantId: i.variantId,
            title: i.title,
            sku: i.sku,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            total: i.total,
            warehouseId: i.warehouseId,
          })),
        },
      },
      include: { items: true, country: true, currency: true },
    });

    await tx.quote.update({
      where: { id: quoteId },
      data: {
        status: "CONVERTED",
        convertedOrderId: createdOrder.id,
        ...(customerId && !quote.customerId ? { customerId } : {}),
      },
    });

    await reserveOrderInventory(createdOrder.id, tx);

    return createdOrder;
  });

  import("../notifications/notifications.service").then(async ({ notificationsService }) => {
    const currency = await prisma.currency.findUnique({ where: { id: order.currencyId } });
    notificationsService.dispatchNotification("ORDER_PLACED", {
      order_number: order.orderNumber,
      customer_name: order.customerName,
      currency: currency?.code || "INR",
      order_total: String(order.total),
      customerId: order.customerId || undefined,
      email: order.customerEmail || quote.customerEmail,
      phone: order.customerPhone || quote.customerPhone || undefined,
    }).catch(console.error);
  });

  void sendQuoteConvertedEmail({
    customerEmail: quote.customerEmail,
    customerName: quote.customerName,
    quoteNumber: quote.quoteNumber,
    orderNumber: order.orderNumber,
    items: quote.items.map((it) => ({
      title: it.title,
      sku: it.sku || undefined,
      quantity: it.quantity,
      unitPrice: Number(it.unitPrice),
      total: Number(it.total),
    })),
    subtotal: Number(quote.subtotal),
    discount: Number(quote.discount || 0),
    shippingCharge: Number(quote.shippingCharge || 0),
    total: Number(order.total),
    currencySymbol: quote.currency?.symbol || "₹",
    countryCode: quote.country?.code || undefined,
    shippingAddress: quote.shippingAddress as Record<string, any> | null,
  });
  return order;
}

export async function softDeleteQuote(id: string) {
  const existing = await prisma.quote.findUnique({ where: { id } });
  if (!existing) throw new AppError("Quote not found.", 404);
  if (existing.deletedAt) throw new AppError("Quote is already archived.", 400);

  return prisma.quote.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

export async function restoreQuote(id: string) {
  const existing = await prisma.quote.findUnique({ where: { id } });
  if (!existing) throw new AppError("Quote not found.", 404);
  if (!existing.deletedAt) throw new AppError("Quote is already active.", 400);

  return prisma.quote.update({
    where: { id },
    data: { deletedAt: null },
  });
}

export async function permanentDeleteQuote(id: string) {
  return prisma.$transaction(async (tx) => {
    const quote = await tx.quote.findUnique({
      where: { id },
    });

    if (!quote) throw new AppError("Quote not found.", 404);

    // Guard 1: Converted quotes cannot be permanently deleted
    if (quote.status === "CONVERTED" || quote.convertedOrderId) {
      throw new AppError(
        "Cannot permanently delete a converted quote. Converted quotes are linked to commercial orders and must be retained.",
        400,
      );
    }

    // Guard 2: Cannot delete if linked order exists in DB referencing fromQuoteId
    const linkedOrder = await tx.order.findFirst({
      where: { fromQuoteId: id },
    });
    if (linkedOrder) {
      throw new AppError(
        `Cannot permanently delete quote linked to Order #${linkedOrder.orderNumber}. Commercial history must be retained.`,
        400,
      );
    }

    // Guard 3: Cannot permanently delete SENT or ACCEPTED quotes
    if (quote.status === "SENT" || quote.status === "ACCEPTED") {
      throw new AppError(
        `Cannot permanently delete quote with status "${quote.status}". Retained commercial negotiation history must be preserved.`,
        400,
      );
    }

    // Clean up dependent records in transaction
    await tx.quoteItem.deleteMany({ where: { quoteId: id } });
    await tx.quoteNote.deleteMany({ where: { quoteId: id } });

    return tx.quote.delete({ where: { id } });
  });
}

export const deleteQuote = softDeleteQuote;

export async function bulkPermanentDeleteQuotes(ids: string[]) {
  const deletedIds: string[] = [];
  const blocked: Array<{ id: string; name: string; reason: string }> = [];

  if (!ids || ids.length === 0) {
    return {
      deletedCount: 0,
      blockedCount: 0,
      deletedIds: [],
      blocked: [],
    };
  }

  const uniqueIds = Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));

  // 1. Fetch requested quotes in safe chunks
  const quotes: Array<{ id: string; quoteNumber: string | null; deletedAt: Date | null }> = [];
  const FETCH_CHUNK = 500;
  for (let i = 0; i < uniqueIds.length; i += FETCH_CHUNK) {
    const chunk = uniqueIds.slice(i, i + FETCH_CHUNK);
    const rows = await prisma.quote.findMany({
      where: { id: { in: chunk } },
      select: { id: true, quoteNumber: true, deletedAt: true },
    });
    quotes.push(...rows);
  }
  const quoteMap = new Map(quotes.map((q) => [q.id, q]));

  const toDeleteIds: string[] = [];

  for (const id of uniqueIds) {
    const quote = quoteMap.get(id);
    if (!quote) {
      blocked.push({ id, name: id, reason: "Quote not found." });
      continue;
    }

    if (!quote.deletedAt) {
      blocked.push({
        id,
        name: quote.quoteNumber ? `Quote #${quote.quoteNumber}` : id,
        reason: "Cannot permanently delete quote: Quote must be archived first.",
      });
      continue;
    }

    toDeleteIds.push(id);
  }

  // 2. Batch delete unblocked quotes in chunks of 100 with set-based deleteMany
  const BATCH_DELETE_CHUNK = 100;
  for (let i = 0; i < toDeleteIds.length; i += BATCH_DELETE_CHUNK) {
    const chunk = toDeleteIds.slice(i, i + BATCH_DELETE_CHUNK);
    try {
      await prisma.$transaction(
        async (tx) => {
          await tx.quoteItem.deleteMany({ where: { quoteId: { in: chunk } } });
          await tx.quoteNote.deleteMany({ where: { quoteId: { in: chunk } } });
          await tx.quote.deleteMany({ where: { id: { in: chunk } } });
        },
        { timeout: 30000 }
      );
      deletedIds.push(...chunk);
    } catch {
      for (const chunkId of chunk) {
        try {
          await permanentDeleteQuote(chunkId);
          deletedIds.push(chunkId);
        } catch (individualError: any) {
          const q = quoteMap.get(chunkId);
          blocked.push({
            id: chunkId,
            name: q?.quoteNumber ? `Quote #${q.quoteNumber}` : chunkId,
            reason: individualError?.message || "Failed to permanently delete quote.",
          });
        }
      }
    }
  }

  return {
    deletedCount: deletedIds.length,
    blockedCount: blocked.length,
    deletedIds: deletedIds.length > 500 ? deletedIds.slice(0, 500) : deletedIds,
    blocked: blocked.slice(0, 100),
  };
}
