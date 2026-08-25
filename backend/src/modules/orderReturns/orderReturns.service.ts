import { prisma } from "../../config/database";
import { AppError } from "../../utils/apiResponse";
import Razorpay from "razorpay";

export async function createReturnRequest(
  customerId: string,
  orderId: string,
  input: {
    reason: string;
    notes?: string;
    refundDetails?: string;
    attachmentUrls?: string[];
    items: { orderItemId: string; quantity: number }[];
  }
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, returns: { include: { items: true } } },
  });

  if (!order) throw new AppError("Order not found.", 404);
  if (order.customerId !== customerId) throw new AppError("Access denied.", 403);
  if (order.status !== "DELIVERED" && order.status !== "RETURNED" && order.status !== "RETURN_REQUESTED") {
    throw new AppError("Only delivered or partially returned orders can be returned.", 400);
  }

  // Validate return window days
  const latestDeliveryEvent = await prisma.shipmentEvent.findFirst({
    where: {
      shipment: { orderId },
      status: "DELIVERED",
    },
    orderBy: { timestamp: "desc" },
  });
  const deliveryDate = latestDeliveryEvent?.timestamp || order.updatedAt;

  const returnWindowSetting = await prisma.setting.findUnique({
    where: { key: "return_window_days" },
  });
  const returnWindowDays = returnWindowSetting ? parseInt(returnWindowSetting.value, 10) : 7;

  const now = new Date();
  const diffTime = Math.abs(now.getTime() - deliveryDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays > returnWindowDays) {
    throw new AppError(`The return window for this order has expired. Returns are only allowed within ${returnWindowDays} days of delivery.`, 400);
  }

  // Validate quantities and calculate refund amount
  let totalRefund = 0;
  const returnItemsData: { orderItemId: string; quantity: number }[] = [];

  for (const itemInput of input.items) {
    const orderItem = order.items.find((item) => item.id === itemInput.orderItemId);
    if (!orderItem) throw new AppError(`Item ${itemInput.orderItemId} is not in this order.`, 400);

    // Calculate already returned quantity for this item
    const alreadyReturned = order.returns
      .filter((ret) => ret.status !== "REJECTED" && ret.status !== ("CANCELLED" as any))
      .reduce((sum, ret) => {
        const matchingItem = ret.items.find((i) => i.orderItemId === orderItem.id);
        return sum + (matchingItem?.quantity || 0);
      }, 0);

    const availableToReturn = orderItem.quantity - alreadyReturned;
    if (itemInput.quantity <= 0 || itemInput.quantity > availableToReturn) {
      throw new AppError(
        `Invalid return quantity for item ${orderItem.title}. Maximum returnable: ${availableToReturn}.`,
        400
      );
    }

    // Proportionate unit price + tax refund calculation
    const itemPrice = Number(orderItem.unitPrice);
    const itemTaxRate = orderItem.quantity > 0 ? Number(orderItem.taxAmount) / orderItem.quantity : 0;
    totalRefund += (itemPrice + itemTaxRate) * itemInput.quantity;

    returnItemsData.push({
      orderItemId: orderItem.id,
      quantity: itemInput.quantity,
    });
  }

  // Create Return request
  const returnRequest = await prisma.$transaction(async (tx) => {
    const created = await tx.orderReturn.create({
      data: {
        orderId,
        customerId,
        reason: input.reason,
        notes: input.notes,
        refundDetails: input.refundDetails,
        attachmentUrls: input.attachmentUrls,
        refundAmount: totalRefund,
        items: {
          create: returnItemsData.map((item) => ({
            orderItemId: item.orderItemId,
            quantity: item.quantity,
          })),
        },
      },
      include: { items: { include: { orderItem: true } } },
    });

    // Check if this return request covers all remaining items in the order
    const totalOrderedQty = order.items.reduce((sum, item) => sum + item.quantity, 0);
    const totalReturnedQty = order.returns
      .filter((ret) => ret.status !== "REJECTED" && ret.status !== ("CANCELLED" as any))
      .reduce((sum, ret) => {
        return sum + ret.items.reduce((itemSum, item) => itemSum + item.quantity, 0);
      }, 0);
    const requestQty = returnItemsData.reduce((sum, item) => sum + item.quantity, 0);
    const isFullReturnRequest = (totalReturnedQty + requestQty) >= totalOrderedQty;

    if (isFullReturnRequest) {
      await tx.order.update({
        where: { id: orderId },
        data: { status: "RETURN_REQUESTED" },
      });
    }

    return created;
  });

  return returnRequest;
}

export async function listCustomerReturns(customerId: string) {
  return prisma.orderReturn.findMany({
    where: { customerId },
    include: {
      order: { select: { orderNumber: true, status: true } },
      items: { include: { orderItem: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function listAllReturns(query: { status?: string; page?: string; limit?: string }) {
  const status = query.status as never;
  const page = Math.max(1, parseInt(query.page || "1"));
  const limit = Math.max(1, parseInt(query.limit || "10"));
  const skip = (page - 1) * limit;

  const where: any = {};
  if (status) where.status = status;

  const [total, data] = await Promise.all([
    prisma.orderReturn.count({ where }),
    prisma.orderReturn.findMany({
      where,
      include: {
        customer: { select: { firstName: true, lastName: true, email: true } },
        order: { select: { orderNumber: true, total: true, currency: { select: { symbol: true } } } },
        items: { include: { orderItem: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
  ]);

  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getReturnDetails(id: string) {
  const returnRequest = await prisma.orderReturn.findUnique({
    where: { id },
    include: {
      customer: { select: { firstName: true, lastName: true, email: true, phone: true } },
      order: {
        select: {
          id: true,
          orderNumber: true,
          status: true,
          paymentStatus: true,
          paymentMethod: true,
          currency: { select: { symbol: true } },
        },
      },
      items: { include: { orderItem: true } },
    },
  });

  if (!returnRequest) throw new AppError("Return request not found.", 404);
  return returnRequest;
}

export async function updateReturnStatus(
  id: string,
  status: "APPROVED" | "REJECTED" | "COMPLETED",
  adminNotes?: string,
  refundMethod?: string,
  transactionReference?: string
) {
  const returnRequest = await prisma.orderReturn.findUnique({
    where: { id },
    include: { items: { include: { orderItem: true } } },
  });

  if (!returnRequest) throw new AppError("Return request not found.", 404);

  if (returnRequest.status === "COMPLETED" || returnRequest.status === "REJECTED") {
    throw new AppError("Completed or rejected returns cannot be updated.", 400);
  }

  // Trigger Razorpay Refund API if requested
  if (status === "COMPLETED" && refundMethod === "RAZORPAY") {
    const transaction = await prisma.paymentTransaction.findFirst({
      where: { orderId: returnRequest.orderId, status: "SUCCESS" },
      orderBy: { attemptNumber: "desc" },
    });
    if (!transaction || !transaction.gatewayPaymentId) {
      throw new AppError("No successful online payment transaction found for this order to issue a Razorpay refund. Please perform a manual refund.", 400);
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
      const amountInPaise = Math.round(Number(returnRequest.refundAmount) * 100);
      await rzp.payments.refund(transaction.gatewayPaymentId, {
        amount: amountInPaise,
        notes: {
          orderReturnId: returnRequest.id,
        },
      });
    } catch (err: any) {
      throw new AppError(`Razorpay Refund failed: ${err.message || err.description || err}`, 400);
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updatedReturn = await tx.orderReturn.update({
      where: { id },
      data: { status, adminNotes, transactionReference } as any,
    });

    if (status === "REJECTED") {
      // Revert order status back to DELIVERED or RETURNED depending on whether other returns exist
      const completedReturnsCount = await tx.orderReturn.count({
        where: { orderId: returnRequest.orderId, status: "COMPLETED" },
      });
      const originalStatus = completedReturnsCount > 0 ? "RETURNED" : "DELIVERED";
      await tx.order.update({
        where: { id: returnRequest.orderId },
        data: { status: originalStatus },
      });
    } else if (status === "COMPLETED") {
      // Fetch the order to calculate totals
      const order = await tx.order.findUnique({
        where: { id: returnRequest.orderId },
        include: { items: true, returns: { include: { items: true } } },
      });

      if (!order) throw new AppError("Order not found.", 404);

      let totalOrderedQty = order.items.reduce((sum, item) => sum + item.quantity, 0);
      let totalReturnedQty = order.returns
        .filter((ret) => ret.status === "COMPLETED" || ret.id === returnRequest.id)
        .reduce((sum, ret) => {
          return sum + ret.items.reduce((itemSum, item) => itemSum + item.quantity, 0);
        }, 0);

      const isFullyReturned = totalReturnedQty >= totalOrderedQty;

      // Complete refund and restock items
      await tx.order.update({
        where: { id: returnRequest.orderId },
        data: {
          status: isFullyReturned ? "RETURNED" : "DELIVERED",
          paymentStatus: isFullyReturned ? "REFUNDED" : "PAID",
        },
      });

      // Restock inventory back to warehouses
      for (const returnItem of returnRequest.items) {
        const orderItem = returnItem.orderItem;
        const inv = orderItem.variantId
          ? await tx.inventory.findFirst({
              where: { variantId: orderItem.variantId, warehouseId: orderItem.warehouseId },
            })
          : await tx.inventory.findFirst({
              where: { productId: orderItem.productId, variantId: null, warehouseId: orderItem.warehouseId },
            });

        if (inv) {
          const nextStock = inv.stock + returnItem.quantity;
          await tx.inventory.update({
            where: { id: inv.id },
            data: { stock: nextStock },
          });

          await tx.inventoryAdjustment.create({
            data: {
              inventoryId: inv.id,
              variantId: orderItem.variantId ?? null,
              previousQty: inv.stock,
              newQty: nextStock,
              reason: "stock_replenish",
              adjustedBy: `system:return_complete;return:${returnRequest.id}`,
            },
          });
        } else {
          const newInv = await tx.inventory.create({
            data: {
              productId: orderItem.productId,
              variantId: orderItem.variantId,
              warehouseId: orderItem.warehouseId,
              stock: returnItem.quantity,
            },
          });

          await tx.inventoryAdjustment.create({
            data: {
              inventoryId: newInv.id,
              variantId: orderItem.variantId ?? null,
              previousQty: 0,
              newQty: returnItem.quantity,
              reason: "stock_replenish",
              adjustedBy: `system:return_complete;return:${returnRequest.id}`,
            },
          });
        }
      }
    }

    return updatedReturn;
  });

  return updated;
}

export async function cancelReturnRequest(customerId: string, returnId: string) {
  const returnRequest = await prisma.orderReturn.findUnique({
    where: { id: returnId },
  });

  if (!returnRequest) throw new AppError("Return request not found.", 404);
  if (returnRequest.customerId !== customerId) throw new AppError("Access denied.", 403);
  if (returnRequest.status !== "PENDING") {
    throw new AppError("Only pending return requests can be cancelled.", 400);
  }

  // Update the return request status to CANCELLED and revert order status if needed
  await prisma.$transaction(async (tx) => {
    await tx.orderReturn.update({
      where: { id: returnId },
      data: { status: "CANCELLED" as any },
    });

    const completedReturnsCount = await tx.orderReturn.count({
      where: { orderId: returnRequest.orderId, status: "COMPLETED" },
    });
    const originalStatus = completedReturnsCount > 0 ? "RETURNED" : "DELIVERED";
    await tx.order.update({
      where: { id: returnRequest.orderId },
      data: { status: originalStatus },
    });
  });

  return { success: true };
}
