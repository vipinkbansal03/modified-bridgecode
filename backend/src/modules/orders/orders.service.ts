import { prisma } from "../../config/database";
import type { Prisma } from "@prisma/client";
import { AppError, getPagination } from "../../utils/apiResponse";
import { assertActiveCountry, assertSellableInCountry } from "../countries/countryAvailability.service";
import { resolvePrice } from "../pricing/priceResolver.service";
import { reserveOrderInventory, commitOrderReservation, releaseOrderReservation } from "../inventory/inventoryReservation.service";
import { resolveItemFulfillmentWarehouse } from "../warehouse/warehouseResolver.service";
import Razorpay from "razorpay";

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
  productId?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortDir?: string;
  deleted?: string;
}) {
  const { page, limit, skip } = getPagination(query);
  const where: Prisma.OrderWhereInput = {};
  if (query.deleted === "true" || query.deleted === "1") {
    where.deletedAt = { not: null };
  } else {
    where.deletedAt = null;
  }
  if (query.status) where.status = query.status as never;
  if (query.paymentStatus) where.paymentStatus = query.paymentStatus as never;
  if (query.paymentMethod) where.paymentMethod = query.paymentMethod;
  if (query.productId) {
    const ids = query.productId.split(",").map((s) => s.trim()).filter(Boolean);
    if (ids.length > 1) {
      where.items = {
        some: {
          productId: { in: ids },
        },
      };
    } else if (ids.length === 1) {
      where.items = {
        some: {
          productId: ids[0],
        },
      };
    }
  }
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
  const o = await prisma.order.findUnique({
    where: { id },
    include: {
      items: { include: { product: true, variant: true, warehouse: true as any } },
      country: true,
      currency: true,
      coupon: true,
      shippingZone: { include: { provider: true, countries: { include: { country: true } } } },
      shippingBox: true,
      orderBoxes: true,
      paymentTransactions: { orderBy: { attemptNumber: "desc" } },
      returns: { include: { items: true } },
    },
  });
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
  items: {
    productId: string;
    variantId?: string | null;
    quantity: number | string;
    overridePrice?: number | string | null;
    warehouseId?: string | null;
  }[];
}) {
  if (!Array.isArray(input.items) || input.items.length === 0) throw new AppError("Add at least one order item.", 400);

  const customer = input.customerId
    ? await prisma.customer.findUnique({ where: { id: input.customerId, deletedAt: null }, include: { defaultCountry: true, addresses: true } })
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

  const shippingAddressObj = (input.shippingAddress || {}) as Record<string, any>;
  const destinationState = (shippingAddressObj.state as string) || customer?.addresses?.[0]?.state || null;
  const destinationCountryCode = country.code;
  const destinationCountryId = country.id;

  const orderItems = await Promise.all(input.items.map(async (item) => {
    const product = productMap.get(item.productId);
    if (!product) throw new AppError("Product not found.", 400);
    const variant = item.variantId ? variantMap.get(item.variantId) : null;
    if (item.variantId && !variant) throw new AppError("Variant not found.", 400);
    if (variant && variant.productId !== product.id) throw new AppError("Variant does not belong to product.", 400);

    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) throw new AppError("Quantity must be at least 1.", 400);

    // Resolve warehouse according to the three-state rule:
    // string -> explicit physical, null -> explicit base, undefined -> auto-resolve
    const resolvedWarehouse = await resolveItemFulfillmentWarehouse(prisma, {
      productId: product.id,
      variantId: variant?.id ?? null,
      quantity,
      explicitWarehouseId: item.warehouseId,
      destinationState,
      destinationCountryCode,
      destinationCountryId,
    });

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
      warehouseId: resolvedWarehouse.warehouseId,
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

  const order = await prisma.order.create({
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
          warehouseId: item.warehouseId,
        })),
      },
    },
    include: { items: { include: { product: true, variant: true } }, country: true, currency: true },
  });

  await reserveOrderInventory(order.id);

  import("../notifications/notifications.service").then(({ notificationsService }) => {
    notificationsService.dispatchNotification("ORDER_PLACED", {
      order_number: order.orderNumber,
      customer_name: order.customerName,
      currency: order.currency?.code || "INR",
      order_total: String(order.total),
      customerId: order.customerId || undefined,
    }).catch(console.error);
  });

  return order;
}

export const updateStatus = async (id: string, status: string) => {
  const existing = await prisma.order.findUnique({ where: { id }, include: { country: true, currency: true } });
  if (!existing) throw new AppError("Order not found.", 404);
  
  const updated = await prisma.order.update({ where: { id }, data: { status: status as never } });
  
  if (status === "SHIPPED" && existing.status !== "SHIPPED") {
    await commitOrderReservation(id);
  } else if (status === "CANCELLED" && existing.status !== "CANCELLED") {
    await releaseOrderReservation(id);
  }

  if (existing.status !== status) {
    import("../notifications/notifications.service").then(({ notificationsService }) => {
      if (status === "SHIPPED") {
        notificationsService.dispatchNotification("ORDER_SHIPPED", {
          order_number: existing.orderNumber,
          customer_name: existing.customerName,
          carrier_name: existing.shippingProvider || "Courier Partner",
          tracking_number: existing.trackingNumber || "N/A",
          customerId: existing.customerId || undefined,
        }).catch(console.error);
      } else {
        notificationsService.createNotification({
          title: "Order Status Updated",
          message: `Your order #${existing.orderNumber} is now ${status}.`,
          type: "ORDER",
          targetType: "SPECIFIC_CUSTOMER",
          customerId: existing.customerId || undefined,
          link: `/account/orders/${id}`,
        }).catch(console.error);
      }
    });
  }

  return updated;
};
export const updatePaymentStatus = async (id: string, paymentStatus: string) => {
  const order = await prisma.order.findUnique({ where: { id }, include: { country: true, currency: true } });
  if (!order) throw new AppError("Order not found.", 404);

  const updated = await prisma.order.update({ where: { id }, data: { paymentStatus: paymentStatus as never } });

  if (paymentStatus === "PAID") {
    import("../notifications/notifications.service").then(({ notificationsService }) => {
      notificationsService.dispatchNotification("PAYMENT_SUCCESS", {
        order_number: order.orderNumber,
        customer_name: order.customerName,
        currency: order.currency?.code || "INR",
        order_total: String(order.total),
        customerId: order.customerId || undefined,
      }).catch(console.error);
    });
  }

  return updated;
};
export const updateShipping = (id: string, data: { shippingProvider?: string; trackingNumber?: string }) =>
  prisma.order.update({ where: { id }, data });

export async function shipOrder(id: string, data: { shippingProvider: string; trackingNumber: string }) {
  const order = await getOrder(id);

  if (order.paymentMethod === "RAZORPAY" && order.paymentStatus !== "PAID") {
    throw new AppError("Cannot ship. Payment must be PAID for online prepaid orders.", 400);
  }

  await commitOrderReservation(id);

  const updated = await prisma.order.update({
    where: { id },
    data: {
      status: "SHIPPED",
      shippingProvider: data.shippingProvider,
      trackingNumber: data.trackingNumber,
    },
  });

  const shipments = await prisma.shipment.findMany({
    where: { orderId: id },
  });

  if (shipments.length > 0) {
    for (const shipment of shipments) {
      await prisma.shipment.update({
        where: { id: shipment.id },
        data: {
          status: "LABEL_GENERATED",
          trackingNumber: data.trackingNumber,
          awbNumber: data.trackingNumber,
        },
      });

      await prisma.shipmentEvent.create({
        data: {
          shipmentId: shipment.id,
          status: "LABEL_GENERATED",
          location: "Warehouse",
          description: `Shipment marked as shipped via ${data.shippingProvider} with tracking number ${data.trackingNumber}.`,
        },
      });
    }
  } else {
    const provider = await prisma.shippingProvider.findFirst({
      where: { displayName: data.shippingProvider },
    }) || await prisma.shippingProvider.findFirst();

    if (provider) {
      await prisma.shipment.create({
        data: {
          orderId: id,
          providerId: provider.id,
          status: "LABEL_GENERATED",
          trackingNumber: data.trackingNumber,
          awbNumber: data.trackingNumber,
          events: {
            create: {
              status: "LABEL_GENERATED",
              location: "Warehouse",
              description: `Shipment created and marked as shipped via ${data.shippingProvider} with tracking number ${data.trackingNumber}.`,
            },
          },
        },
      });
    }
  }

  import("../notifications/notifications.service").then(({ notificationsService }) => {
    notificationsService.dispatchNotification("ORDER_SHIPPED", {
      order_number: order.orderNumber,
      customer_name: order.customerName,
      carrier_name: data.shippingProvider,
      tracking_number: data.trackingNumber,
      customerId: order.customerId || undefined,
    }).catch(console.error);
  });

  return updated;
}

export async function deliverOrder(id: string) {
  const order: any = await getOrder(id);
  if (order.status === "DELIVERED") {
    return order;
  }

  if (order.paymentMethod === "RAZORPAY" && order.paymentStatus !== "PAID") {
    throw new AppError("Cannot deliver. Payment must be PAID for online prepaid orders.", 400);
  }

  const nextPaymentStatus = order.paymentMethod === "PAY_ON_DELIVERY" && order.paymentStatus === "PENDING"
    ? "PAID"
    : undefined;

  const updated = await prisma.order.update({
    where: { id },
    data: { 
      status: "DELIVERED",
      ...(nextPaymentStatus && { paymentStatus: nextPaymentStatus }),
    },
  });

  const shipments = await prisma.shipment.findMany({
    where: { orderId: id },
  });

  if (shipments.length > 0) {
    for (const shipment of shipments) {
      await prisma.shipment.update({
        where: { id: shipment.id },
        data: { status: "DELIVERED" },
      });

      await prisma.shipmentEvent.deleteMany({
        where: { shipmentId: shipment.id },
      });

      await prisma.shipmentEvent.create({
        data: {
          shipmentId: shipment.id,
          status: "DELIVERED",
          location: "Destination",
          description: "Shipment delivered successfully. Signed by recipient.",
        },
      });
    }
  }

  import("../notifications/notifications.service").then(({ notificationsService }) => {
    notificationsService.createNotification({
      title: "Order Delivered",
      message: `Your order #${order.orderNumber} has been delivered.`,
      type: "INFO",
      targetType: "SPECIFIC_CUSTOMER",
      customerId: order.customerId || undefined,
      link: `/account/orders/${id}`,
    }).catch(console.error);
  });

  return updated;
}


export async function refundCancelledOrder(
  orderId: string,
  refundMethod: "RAZORPAY" | "MANUAL",
  transactionReference?: string
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) throw new AppError("Order not found.", 404);
  if (order.status !== "CANCELLED") {
    throw new AppError("Only cancelled orders can be refunded.", 400);
  }
  if (order.paymentStatus !== "PAID") {
    throw new AppError("Only paid orders can be refunded.", 400);
  }

  if (refundMethod === "RAZORPAY") {
    const transaction = await prisma.paymentTransaction.findFirst({
      where: { orderId, status: "SUCCESS" },
      orderBy: { attemptNumber: "desc" },
    });
    if (!transaction || !transaction.gatewayPaymentId) {
      throw new AppError("No successful online payment transaction found for this order. Please process refund manually.", 400);
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      throw new AppError("Razorpay credentials are not configured.", 500);
    }

    const rzp = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    try {
      const amountInPaise = Math.round(Number(order.total) * 100);
      await rzp.payments.refund(transaction.gatewayPaymentId, {
        amount: amountInPaise,
        notes: {
          orderId,
        },
      });
    } catch (err: any) {
      throw new AppError(`Razorpay Refund failed: ${err.message || err.description || err}`, 400);
    }
  } else {
    if (!transactionReference?.trim()) {
      throw new AppError("Manual Transfer Reference / UTR Number is required for manual refund.", 400);
    }
  }

  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: {
      paymentStatus: "REFUNDED",
      cancelTransactionReference: transactionReference || "RAZORPAY_REFUND",
    } as any,
  });

  return updatedOrder;
}

export async function softDeleteOrder(id: string) {
  const existing = await prisma.order.findUnique({
    where: { id },
  });
  if (!existing) throw new AppError("Order not found.", 404);

  const updated = await prisma.order.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  return updated;
}

export async function permanentDeleteOrder(id: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id },
      include: {
        paymentTransactions: true,
        shipments: true,
        returns: true,
        items: true,
      },
    });

    if (!order) throw new AppError("Order not found.", 404);

    // Guard 1: Must be explicitly marked as a test order
    if (!order.isTest) {
      throw new AppError("Cannot permanently delete a real order. Only test orders can be permanently deleted.", 400);
    }

    // Guard 2: No captured or refunded payment
    if (order.paymentStatus === "PAID" || order.paymentStatus === "REFUNDED") {
      throw new AppError(`Cannot permanently delete order with payment status "${order.paymentStatus}".`, 400);
    }

    // Guard 3: Order lifecycle status check
    const nonDeletableStatuses = ["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED", "RETURN_REQUESTED", "RETURNED"];
    if (nonDeletableStatuses.includes(order.status)) {
      throw new AppError(`Cannot permanently delete order with status "${order.status}".`, 400);
    }

    // Guard 4: No successful payment gateway transactions
    const hasSuccessfulPayment = order.paymentTransactions.some(
      (t) => t.status === "SUCCESS" || Boolean(t.gatewayPaymentId)
    );
    if (hasSuccessfulPayment) {
      throw new AppError("Cannot permanently delete order with captured payment gateway transactions.", 400);
    }

    // Guard 5: No dispatched shipments
    const hasDispatchedShipment = order.shipments.some(
      (s) => s.status !== "CREATED" || Boolean(s.trackingNumber) || Boolean(s.awbNumber)
    );
    if (hasDispatchedShipment) {
      throw new AppError("Cannot permanently delete order with shipment/tracking history.", 400);
    }

    // Guard 6: No return requests
    if (order.returns.length > 0) {
      throw new AppError("Cannot permanently delete order with associated return requests.", 400);
    }

    // Guard 7: No converted quote relationship
    if (order.fromQuoteId) {
      throw new AppError("Cannot permanently delete an order converted from a formal quote.", 400);
    }

    // 8. Safely release any inventory reservation holding stock
    await releaseOrderReservation(order.id, tx);

    // 9. Clean inventory adjustment audit logs created for this test order reservation
    await tx.inventoryAdjustment.deleteMany({
      where: {
        adjustedBy: `system:reservation;order:${order.id}`,
      },
    });

    // 10. Delete child records in FK-safe transactional order
    await tx.orderShippingBox.deleteMany({ where: { orderId: id } });
    await tx.shipmentEvent.deleteMany({
      where: {
        shipment: { orderId: id },
      },
    });
    await tx.shipment.deleteMany({ where: { orderId: id } });
    await tx.paymentTransaction.deleteMany({ where: { orderId: id } });
    await tx.orderReturnItem.deleteMany({
      where: {
        orderReturn: { orderId: id },
      },
    });
    await tx.orderReturn.deleteMany({ where: { orderId: id } });
    await tx.quote.updateMany({
      where: { convertedOrderId: id },
      data: { convertedOrderId: null },
    });
    await tx.orderItem.deleteMany({ where: { orderId: id } });

    // 11. Finally delete the order record
    const deleted = await tx.order.delete({ where: { id } });

    return deleted;
  });
}
