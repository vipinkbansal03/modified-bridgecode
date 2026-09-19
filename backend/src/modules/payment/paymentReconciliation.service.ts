import { prisma } from "../../config/database";
import { logger } from "../../config/logger";
import { AppError } from "../../utils/apiResponse";
import { releaseOrderReservation } from "../inventory/inventoryReservation.service";
import { PaymentProvider } from "@prisma/client";

/**
 * 1. Reconciles successful payment from SDK verification or Webhook
 * - Updates PaymentTransaction to SUCCESS
 * - Updates Order to paymentStatus = PAID, status = PROCESSING
 * - Preserves active inventory reservation (Zero physical stock commit)
 * - Fully idempotent against duplicate webhook/verification calls
 */
export async function reconcilePaymentSuccess(params: {
  orderId?: string;
  gatewayOrderId: string;
  gatewayPaymentId: string;
  gatewaySignature?: string | null;
  provider?: PaymentProvider;
  metadata?: Record<string, unknown>;
}) {
  const { orderId, gatewayOrderId, gatewayPaymentId, gatewaySignature, provider = "RAZORPAY", metadata } = params;

  // 1. Locate PaymentTransaction
  let txRecord = await prisma.paymentTransaction.findFirst({
    where: { gatewayOrderId },
    include: { order: true },
  });

  if (!txRecord && orderId) {
    txRecord = await prisma.paymentTransaction.findFirst({
      where: { orderId },
      orderBy: { attemptNumber: "desc" },
      include: { order: true },
    });
  }

  const targetOrderId = txRecord?.orderId || orderId;
  if (!targetOrderId) {
    logger.warn(`[paymentReconciliation] Could not find order for gatewayOrderId: ${gatewayOrderId}`);
    throw new AppError("Payment transaction or order not found.", 404);
  }

  const order = txRecord?.order || await prisma.order.findUnique({ where: { id: targetOrderId } });
  if (!order) {
    throw new AppError("Order not found.", 404);
  }

  // Idempotency: If order is already PAID and tx is SUCCESS, return cleanly
  if (order.paymentStatus === "PAID" && txRecord?.status === "SUCCESS") {
    logger.info(`[paymentReconciliation] Order ${order.id} is already marked PAID and transaction is SUCCESS. Idempotent skip.`);
    return { order, transaction: txRecord, alreadyProcessed: true };
  }

  // Handle late payment captured after reservation expiry:
  // If order was cancelled due to expiry, we still mark transaction SUCCESS and flag order for processing/admin review
  const isPostExpiry = order.status === "CANCELLED" || (order.paymentExpiresAt && order.paymentExpiresAt < new Date());
  if (isPostExpiry) {
    logger.warn(`[paymentReconciliation] Payment ${gatewayPaymentId} was captured after order ${order.id} expiry!`);
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1. Update PaymentTransaction
    let updatedTx: any = txRecord;
    if (txRecord) {
      const mergedMetadata = metadata
        ? JSON.parse(JSON.stringify({ ...(txRecord.metadata as object || {}), ...metadata }))
        : (txRecord.metadata ?? undefined);

      updatedTx = await tx.paymentTransaction.update({
        where: { id: txRecord.id },
        data: {
          status: "SUCCESS",
          gatewayPaymentId,
          gatewaySignature: gatewaySignature || txRecord.gatewaySignature,
          metadata: mergedMetadata,
        },
        include: { order: true },
      });
    } else {
      updatedTx = await tx.paymentTransaction.create({
        data: {
          orderId: order.id,
          attemptNumber: 1,
          paymentMethod: provider,
          provider,
          gatewayOrderId,
          gatewayPaymentId,
          gatewaySignature,
          status: "SUCCESS",
          amount: order.total,
          currency: order.currencyId ? "INR" : "INR",
          metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
        },
        include: { order: true },
      });
    }

    // 2. Update Order status
    const updatedOrder = await tx.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: "PAID",
        status: "PROCESSING",
        paymentMethod: provider,
        paymentProvider: provider,
        paymentId: gatewayPaymentId, // Mirror for backward compatibility
      },
      include: {
        items: { include: { product: true, variant: true } },
        country: true,
        currency: true,
        paymentTransactions: { orderBy: { attemptNumber: "desc" } },
      },
    });

    return { order: updatedOrder, transaction: updatedTx, alreadyProcessed: false };
  });

  logger.info(`[paymentReconciliation] Successfully reconciled payment for order ${order.id} (Payment ID: ${gatewayPaymentId})`);
  return result;
}

/**
 * 2. Reconciles payment failure from client callback or Webhook
 * - Marks specific PaymentTransaction as FAILED
 * - Keeps Order retryable if within paymentExpiresAt window
 * - Does NOT release reservation prematurely
 */
export async function reconcilePaymentFailure(params: {
  orderId?: string;
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
  errorCode?: string;
  errorMessage?: string;
  provider?: PaymentProvider;
}) {
  const { orderId, gatewayOrderId, gatewayPaymentId, errorCode, errorMessage, provider = "RAZORPAY" } = params;

  let txRecord = gatewayOrderId
    ? await prisma.paymentTransaction.findFirst({ where: { gatewayOrderId }, include: { order: true } })
    : orderId
    ? await prisma.paymentTransaction.findFirst({ where: { orderId }, orderBy: { attemptNumber: "desc" }, include: { order: true } })
    : null;

  const targetOrderId = txRecord?.orderId || orderId;
  if (!targetOrderId) {
    logger.warn(`[paymentReconciliation] Could not find order for failure reconciliation: ${gatewayOrderId || orderId}`);
    return null;
  }

  const order = txRecord?.order || await prisma.order.findUnique({ where: { id: targetOrderId } });
  if (!order) return null;

  // If order is already PAID, ignore late failure
  if (order.paymentStatus === "PAID") {
    logger.info(`[paymentReconciliation] Ignoring payment failure for already PAID order ${order.id}`);
    return { order, transaction: txRecord, ignored: true };
  }

  const result = await prisma.$transaction(async (tx) => {
    let updatedTx = txRecord;
    if (txRecord && txRecord.status !== "SUCCESS") {
      updatedTx = await tx.paymentTransaction.update({
        where: { id: txRecord.id },
        data: {
          status: "FAILED",
          gatewayPaymentId: gatewayPaymentId || txRecord.gatewayPaymentId,
          errorCode: errorCode || txRecord.errorCode,
          errorMessage: errorMessage || txRecord.errorMessage || "Payment attempt failed.",
        },
        include: { order: true },
      });
    }

    // Check if order has expired (COD orders never expire)
    const isCod = order.paymentMethod === "PAY_ON_DELIVERY" || order.paymentMethod === "COD";
    const isExpired = !isCod && order.paymentExpiresAt && order.paymentExpiresAt < new Date();
    let updatedOrder = order;
    if (isExpired && order.status === "PENDING") {
      await releaseOrderReservation(order.id, tx);
      updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          status: "CANCELLED",
          paymentStatus: "FAILED",
        },
      });
    } else {
      // Keep order PENDING so user can retry while reservation is valid
      updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: isCod ? "PENDING" : "FAILED",
        },
      });
    }

    return { order: updatedOrder, transaction: updatedTx, ignored: false };
  });

  logger.info(`[paymentReconciliation] Recorded payment failure for order ${order.id}`);
  return result;
}

/**
 * 3. Atomically expires an order and releases its reserved inventory
 */
export async function expireOrderAndReleaseStock(orderId: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) return null;

    // Do not expire if already PAID or if Cash on Delivery
    if (order.paymentStatus === "PAID" || order.paymentMethod === "PAY_ON_DELIVERY" || order.paymentMethod === "COD") {
      logger.info(`[paymentReconciliation] Order ${orderId} is ${order.paymentStatus === "PAID" ? "PAID" : "COD"}. Skipping expiration.`);
      return order;
    }

    // Release reserved inventory
    await releaseOrderReservation(order.id, tx);

    // Mark any PENDING payment transactions as EXPIRED
    await tx.paymentTransaction.updateMany({
      where: {
        orderId: order.id,
        status: "PENDING",
      },
      data: {
        status: "EXPIRED",
        errorMessage: "Payment attempt expired before completion.",
      },
    });

    // Mark order as CANCELLED / FAILED
    const updatedOrder = await tx.order.update({
      where: { id: order.id },
      data: {
        status: "CANCELLED",
        paymentStatus: "FAILED",
      },
      include: {
        items: true,
        paymentTransactions: true,
      },
    });

    logger.info(`[paymentReconciliation] Successfully expired order ${order.id} and released reserved stock.`);
    return updatedOrder;
  });
}

/**
 * 4. Background worker to process expired orders
 */
export async function processExpiredOrders(): Promise<number> {
  const now = new Date();
  const expiredOrders = await prisma.order.findMany({
    where: {
      status: "PENDING",
      paymentStatus: { not: "PAID" },
      paymentExpiresAt: { lte: now },
      paymentMethod: { notIn: ["PAY_ON_DELIVERY", "COD"] },
    },
    select: { id: true, orderNumber: true, paymentExpiresAt: true },
    take: 50,
  });

  if (expiredOrders.length === 0) return 0;

  logger.info(`[paymentReconciliation] Found ${expiredOrders.length} expired orders to process.`);
  let count = 0;
  for (const exp of expiredOrders) {
    try {
      await expireOrderAndReleaseStock(exp.id);
      count++;
    } catch (err) {
      logger.error(`[paymentReconciliation] Error expiring order ${exp.id}:`, err);
    }
  }
  return count;
}

/**
 * 5. Fetches payment session state for browser refresh / recovery & countdown
 */
export async function getPaymentSession(customerId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, customerId },
    include: {
      items: { include: { product: true, variant: true } },
      country: true,
      currency: true,
      paymentTransactions: { orderBy: { attemptNumber: "desc" } },
    },
  });

  if (!order) {
    throw new AppError("Order not found.", 404);
  }

  // Lazy check expiry
  const now = new Date();
  const isExpired = order.paymentStatus !== "PAID" && order.paymentExpiresAt && order.paymentExpiresAt < now;
  if (isExpired && order.status !== "CANCELLED") {
    await expireOrderAndReleaseStock(order.id);
    order.status = "CANCELLED";
    order.paymentStatus = "FAILED";
  }

  const secondsRemaining = order.paymentExpiresAt
    ? Math.max(0, Math.floor((order.paymentExpiresAt.getTime() - now.getTime()) / 1000))
    : 0;

  const latestTransaction = order.paymentTransactions[0] || null;
  const isRetryable =
    order.paymentStatus !== "PAID" &&
    order.status !== "CANCELLED" &&
    (order.paymentExpiresAt ? secondsRemaining > 0 : true);

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    subtotal: Number(order.subtotal),
    shippingCharge: Number(order.shippingCharge),
    discount: Number(order.discount),
    taxAmount: Number(order.taxAmount),
    total: Number(order.total),
    currency: order.currency?.code || "INR",
    currencySymbol: order.currency?.symbol || "₹",
    paymentExpiresAt: order.paymentExpiresAt,
    secondsRemaining,
    isRetryable,
    isExpired: isExpired || (order.paymentStatus !== "PAID" && secondsRemaining === 0),
    latestTransaction: latestTransaction
      ? {
          id: latestTransaction.id,
          attemptNumber: latestTransaction.attemptNumber,
          gatewayOrderId: latestTransaction.gatewayOrderId,
          gatewayPaymentId: latestTransaction.gatewayPaymentId,
          status: latestTransaction.status,
          errorCode: latestTransaction.errorCode,
          errorMessage: latestTransaction.errorMessage,
          createdAt: latestTransaction.createdAt,
        }
      : null,
    items: order.items.map((i) => ({
      id: i.id,
      title: i.title,
      sku: i.sku,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
      total: Number(i.total),
      warehouseId: i.warehouseId,
    })),
  };
}
