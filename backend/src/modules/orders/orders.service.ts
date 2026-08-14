import { prisma } from "../../config/database";
import type { Prisma } from "@prisma/client";
import { AppError, getPagination } from "../../utils/apiResponse";
import { assertActiveCountry, assertSellableInCountry } from "../countries/countryAvailability.service";
import { decrementVariantStock } from "../inventory/inventory.service";
import { resolvePrice } from "../pricing/priceResolver.service";
import { releaseStock } from "../customerOrders/customerOrders.service";

export async function getAnalytics() {
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
  twelveMonthsAgo.setDate(1);
  twelveMonthsAgo.setHours(0, 0, 0, 0);

  const [revenueRaw, ordersByCountry, orderTotals] = await Promise.all([
    prisma.$queryRaw<{ month: string; revenue: number; count: number }[]>`
      SELECT
        TO_CHAR(DATE_TRUNC('month', "createdAt"), 'Mon YY') AS month,
        SUM(CAST(total AS FLOAT)) AS revenue,
        COUNT(*) AS count
      FROM orders
      WHERE "createdAt" >= ${twelveMonthsAgo}
        AND "paymentStatus" = 'PAID'
      GROUP BY DATE_TRUNC('month', "createdAt")
      ORDER BY DATE_TRUNC('month', "createdAt") ASC
    `,
    prisma.$queryRaw<{ country: string; count: number }[]>`
      SELECT c.name AS country, COUNT(o.id) AS count
      FROM orders o
      JOIN countries c ON o."countryId" = c.id
      GROUP BY c.name
      ORDER BY count DESC
      LIMIT 8
    `,
    prisma.order.aggregate({ _sum: { total: true }, _count: true }),
  ]);

  return {
    revenueByMonth: revenueRaw.map((r) => ({
      month: r.month,
      revenue: Number(r.revenue),
      orders: Number(r.count),
    })),
    ordersByCountry: ordersByCountry.map((r) => ({
      country: r.country,
      orders: Number(r.count),
    })),
    totals: {
      allTimeRevenue: Number(orderTotals._sum.total ?? 0),
      totalOrders: orderTotals._count,
    },
  };
}

export async function listOrders(query: {
  page?: string;
  limit?: string;
  status?: string;
  paymentStatus?: string;
  paymentMethod?: string;
  search?: string;
  countryId?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortDir?: string;
}) {
  const { page, limit, skip } = getPagination(query);
  const where: Prisma.OrderWhereInput = {};
  if (query.status) where.status = query.status as never;
  if (query.paymentStatus) where.paymentStatus = query.paymentStatus as never;
  if (query.paymentMethod) where.paymentMethod = query.paymentMethod;
  if (query.countryId) {
    const ids = query.countryId.split(",").map((s) => s.trim()).filter(Boolean);
    if (ids.length > 1) {
      where.countryId = { in: ids } as never;
    } else if (ids.length === 1) {
      where.countryId = ids[0];
    }
  }
  if (query.search?.trim()) {
    const search = query.search.trim();
    where.OR = [
      { orderNumber: { contains: search, mode: "insensitive" } },
      { customerName: { contains: search, mode: "insensitive" } },
      { customerEmail: { contains: search, mode: "insensitive" } },
    ];
  }
  if (query.dateFrom || query.dateTo) {
    where.createdAt = {
      ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
      ...(query.dateTo ? { lte: new Date(`${query.dateTo}T23:59:59.999Z`) } : {}),
    };
  }

  const sortDir = query.sortDir === "asc" ? "asc" : "desc";
  const orderBy = (() => {
    switch (query.sortBy) {
      case "orderNumber":
        return [{ orderNumber: sortDir }, { createdAt: "desc" }];
      case "customerName":
        return [{ customerName: sortDir }, { createdAt: "desc" }];
      case "total":
        return [{ total: sortDir }, { createdAt: "desc" }];
      case "status":
        return [{ status: sortDir }, { createdAt: "desc" }];
      case "paymentStatus":
        return [{ paymentStatus: sortDir }, { createdAt: "desc" }];
      case "country":
        return [{ country: { code: sortDir } }, { createdAt: "desc" }];
      case "updatedAt":
        return [{ updatedAt: sortDir }, { createdAt: "desc" }];
      case "createdAt":
      default:
        return [{ createdAt: sortDir }];
    }
  })();

  const [data, total] = await Promise.all([
    prisma.order.findMany({ where, skip, take: limit, orderBy: orderBy as never, include: { country: true, currency: true, shippingZone: { include: { provider: true, countries: { include: { country: true } } } }, _count: { select: { items: true } } } }),
    prisma.order.count({ where }),
  ]);
  return { data, total, page, limit };
}

export async function getOrder(id: string) {
  const o = await prisma.order.findUnique({ where: { id }, include: { items: { include: { product: true, variant: true, warehouse: true as any } }, country: true, currency: true, coupon: true, shippingZone: { include: { provider: true, countries: { include: { country: true } } } }, shippingBox: true, orderBoxes: true } });
  if (!o) throw new AppError("Order not found.", 404);
  return o;
}

function generateOrderNumber() {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ORD-${Date.now()}-${suffix}`;
}

export async function createAdminOrder(input: {
  customerId?: string | null;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string | null;
  companyName?: string | null;
  countryId?: string | null;
  shippingAddress?: Record<string, unknown>;
  shippingZoneId?: string | null;
  shippingCharge?: number | string | null;
  discount?: number | string | null;
  notes?: string | null;
  items: { productId: string; variantId?: string | null; quantity: number | string; overridePrice?: number | string | null }[];
}) {
  if (!Array.isArray(input.items) || input.items.length === 0) throw new AppError("Add at least one order item.", 400);

  const customer = input.customerId
    ? await prisma.customer.findUnique({ where: { id: input.customerId, deletedAt: null }, include: { defaultCountry: true } })
    : null;
  if (input.customerId && !customer) throw new AppError("Customer not found.", 404);

  const productIds = [...new Set(input.items.map((item) => item.productId))];
  const variantIds = [...new Set(input.items.map((item) => item.variantId).filter(Boolean) as string[])];
  const [products, variants] = await Promise.all([
    prisma.product.findMany({ where: { id: { in: productIds }, deletedAt: null }, include: { defaultCountry: true } }),
    prisma.productVariant.findMany({ where: { id: { in: variantIds } }, include: { inventories: true } }),
  ]);
  if (products.length !== productIds.length) throw new AppError("One or more products were not found.", 400);
  if (variants.length !== variantIds.length) throw new AppError("One or more variants were not found.", 400);

  const productMap = new Map(products.map((product) => [product.id, product]));
  const variantMap = new Map(variants.map((variant) => [variant.id, variant]));
  for (const variant of variants) {
    if (!productIds.includes(variant.productId)) throw new AppError("A selected variant does not belong to the selected product.", 400);
  }

  const fallbackCountryId = input.countryId || customer?.defaultCountryId || products[0]?.defaultCountryId;
  if (!fallbackCountryId) throw new AppError("Country is required for manual order pricing.", 400);
  const country = await assertActiveCountry(fallbackCountryId);

  const orderItems = await Promise.all(input.items.map(async (item) => {
    const product = productMap.get(item.productId);
    if (!product) throw new AppError("Product not found.", 400);
    const variant = item.variantId ? variantMap.get(item.variantId) : null;
    if (item.variantId && !variant) throw new AppError("Variant not found.", 400);
    if (variant && variant.productId !== product.id) throw new AppError("Variant does not belong to product.", 400);

    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) throw new AppError("Quantity must be at least 1.", 400);
    const stockRecord = variant?.inventories.find((inventory) => inventory.countryId === country.id) ?? variant?.inventories.find((inventory) => inventory.countryId === null);
    const availableStock = stockRecord ? Math.max(0, stockRecord.stock - stockRecord.reservedStock) : null;
    if (availableStock !== null && availableStock < quantity) throw new AppError(`Insufficient stock for ${variant?.sku ?? variant?.title}.`, 400);
    await assertSellableInCountry({
      countryId: country.id,
      productId: product.id,
      variantId: variant?.id ?? null,
    });

    const overridePrice = item.overridePrice === undefined || item.overridePrice === null || item.overridePrice === "" ? null : Number(item.overridePrice);
    if (overridePrice !== null && (!Number.isFinite(overridePrice) || overridePrice < 0)) throw new AppError("Override price must be a non-negative number.", 400);
    const resolvedPrice = overridePrice !== null
      ? null
      : await resolvePrice({ productId: product.id, variantId: variant?.id ?? null, countryId: country.id, customerId: customer?.id ?? null, quantity });
    const unitPrice = overridePrice ?? resolvedPrice!.finalPrice;

    return {
      product,
      variant,
      quantity,
      unitPrice,
      total: unitPrice * quantity,
    };
  }));

  const subtotal = orderItems.reduce((sum, item) => sum + item.total, 0);
  const shippingCharge = input.shippingCharge === undefined || input.shippingCharge === null || input.shippingCharge === "" ? 0 : Number(input.shippingCharge);
  const discount = input.discount === undefined || input.discount === null || input.discount === "" ? 0 : Number(input.discount);
  if (!Number.isFinite(shippingCharge) || shippingCharge < 0) throw new AppError("Shipping charge must be a non-negative number.", 400);
  if (!Number.isFinite(discount) || discount < 0) throw new AppError("Discount must be a non-negative number.", 400);
  const total = Math.max(0, subtotal + shippingCharge - discount);

  const customerName = customer ? `${customer.firstName} ${customer.lastName}`.trim() : input.customerName?.trim();
  const customerEmail = customer?.email ?? input.customerEmail?.trim();
  if (!customerName || !customerEmail) throw new AppError("Customer name and email are required.", 400);

  return prisma.order.create({
    data: {
      orderNumber: generateOrderNumber(),
      customerId: customer?.id ?? null,
      customerName,
      customerEmail,
      customerPhone: customer?.phone ?? input.customerPhone ?? null,
      companyName: input.companyName ?? null,
      shippingAddress: (input.shippingAddress ?? {}) as Prisma.InputJsonValue,
      countryId: country.id,
      currencyId: country.currencyId,
      subtotal,
      discount,
      shippingCharge,
      shippingZoneId: input.shippingZoneId ?? null,
      total,
      status: "CONFIRMED",
      paymentStatus: "PENDING",
      notes: input.notes ? `[Manual admin order] ${input.notes}` : "Manual admin order",
      items: {
        create: orderItems.map((item) => ({
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
    include: { items: { include: { product: true, variant: true } }, country: true, currency: true },
  });
}

export const updateStatus = async (id: string, status: string) => {
  const existing = await prisma.order.findUnique({ where: { id } });
  if (!existing) throw new AppError("Order not found.", 404);
  
  const updated = await prisma.order.update({ where: { id }, data: { status: status as never } });
  
  if (status === "CANCELLED" && existing.status !== "CANCELLED") {
    await releaseStock(id);
  }

  if (existing.status !== status) {
    import("../notifications/notifications.service").then(({ notificationsService }) => {
      notificationsService.createNotification({
        title: "Order Status Updated",
        message: `Your order #${existing.orderNumber} is now ${status}.`,
        type: "ORDER",
        targetType: "SPECIFIC_CUSTOMER",
        customerId: existing.customerId,
        link: `/account/orders/${id}`,
      }).catch(console.error);
    });
  }

  return updated;
};
export const updatePaymentStatus = (id: string, paymentStatus: string) => prisma.order.update({ where: { id }, data: { paymentStatus: paymentStatus as never } });
export const updateShipping = (id: string, data: { shippingProvider?: string; trackingNumber?: string }) =>
  prisma.order.update({ where: { id }, data });

export async function shipOrder(id: string, data: { shippingProvider: string; trackingNumber: string }) {
  const order = await getOrder(id);
  const updated = await prisma.order.update({
    where: { id },
    data: {
      status: "SHIPPED",
      shippingProvider: data.shippingProvider,
      trackingNumber: data.trackingNumber,
    },
  });

  import("../notifications/notifications.service").then(({ notificationsService }) => {
    notificationsService.createNotification({
      title: "Order Shipped",
      message: `Your order #${order.orderNumber} has been shipped via ${data.shippingProvider} (Tracking: ${data.trackingNumber}).`,
      type: "ORDER",
      targetType: "SPECIFIC_CUSTOMER",
      customerId: order.customerId,
      link: `/account/orders/${id}`,
    }).catch(console.error);
  });

  return updated;
}

export async function deliverOrder(id: string) {
  const order: any = await getOrder(id);
  if (order.status === "DELIVERED") {
    return order;
  }

  await Promise.all(
    (order.items ?? [])
      .filter((item: any) => item.variantId)
      .map((item: any) =>
        decrementVariantStock(item.variantId!, item.quantity, order.countryId, {
          reason: "order_delivered",
          adjustedBy: `system:${id}`,
        })
      )
  );

  const updated = await prisma.order.update({
    where: { id },
    data: { status: "DELIVERED" },
  });

  import("../notifications/notifications.service").then(({ notificationsService }) => {
    notificationsService.createNotification({
      title: "Order Delivered",
      message: `Your order #${order.orderNumber} has been delivered.`,
      type: "ORDER",
      targetType: "SPECIFIC_CUSTOMER",
      customerId: order.customerId,
      link: `/account/orders/${id}`,
    }).catch(console.error);
  });

  return updated;
}

export const deleteOrder = async (id: string) => {
  await prisma.orderItem.deleteMany({ where: { orderId: id } });
  return prisma.order.delete({ where: { id } });
};
