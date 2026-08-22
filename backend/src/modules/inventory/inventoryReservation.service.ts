import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { logger } from "../../config/logger";

/**
 * Helper to execute inside an existing transaction or standalone
 */
async function withTx<T>(
  tx: Prisma.TransactionClient | undefined,
  fn: (client: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  if (tx) {
    return fn(tx);
  }
  return prisma.$transaction(async (newTx) => fn(newTx));
}

/**
 * Finds the matching inventory record for an order item by variant/product and warehouse.
 */
async function findItemInventory(
  tx: Prisma.TransactionClient,
  item: { productId: string; variantId: string | null; warehouseId: string | null }
) {
  if (item.variantId) {
    if (item.warehouseId) {
      const inv = await tx.inventory.findFirst({
        where: { variantId: item.variantId, warehouseId: item.warehouseId },
      });
      if (inv) return inv;
    }
    // Fallback: any inventory for this variant
    return tx.inventory.findFirst({
      where: { variantId: item.variantId },
    });
  }

  // Product-level inventory without variant
  if (item.warehouseId) {
    const inv = await tx.inventory.findFirst({
      where: { productId: item.productId, variantId: null, warehouseId: item.warehouseId },
    });
    if (inv) return inv;
  }
  return tx.inventory.findFirst({
    where: { productId: item.productId, variantId: null },
  });
}

/**
 * 1. RESERVE INVENTORY (Invoked upon Order Creation)
 * - stock: UNCHANGED
 * - reservedStock: += quantity
 * - Idempotent: Skips if payment_reservation adjustment already exists for this order.
 */
export async function reserveOrderInventory(
  orderId: string,
  txClient?: Prisma.TransactionClient
): Promise<void> {
  await withTx(txClient, async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order || !order.items.length) return;

    // Idempotency check: verify if reservation already logged for this order
    const existingReservation = await tx.inventoryAdjustment.findFirst({
      where: {
        reason: "payment_reservation",
        adjustedBy: `system:reservation;order:${order.id}`,
      },
    });
    if (existingReservation) {
      logger.info(`[inventoryReservation] Reservation already exists for order ${order.id}. Skipping.`);
      return;
    }

    for (const item of order.items) {
      const inv = await findItemInventory(tx, item);
      if (!inv) {
        logger.warn(`[inventoryReservation] No inventory record found to reserve for item ${item.id} (variant: ${item.variantId}, product: ${item.productId})`);
        continue;
      }

      const nextReservedStock = inv.reservedStock + item.quantity;
      await tx.inventory.update({
        where: { id: inv.id },
        data: { reservedStock: nextReservedStock },
      });

      await tx.inventoryAdjustment.create({
        data: {
          inventoryId: inv.id,
          variantId: item.variantId ?? null,
          previousQty: inv.reservedStock,
          newQty: nextReservedStock,
          reason: "payment_reservation",
          adjustedBy: `system:reservation;order:${order.id}`,
        },
      });
    }

    logger.info(`[inventoryReservation] Successfully reserved inventory for order ${order.id}`);
  });
}

/**
 * 2. COMMIT RESERVATION (Invoked strictly upon Shipment / Dispatch)
 * - stock: -= quantity
 * - reservedStock: -= quantity
 * - Idempotent: Skips if shipment_stock_commit adjustment already exists for this order.
 */
export async function commitOrderReservation(
  orderId: string,
  txClient?: Prisma.TransactionClient
): Promise<void> {
  await withTx(txClient, async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order || !order.items.length) return;

    // Idempotency check: verify if commit already logged for this order
    const existingCommit = await tx.inventoryAdjustment.findFirst({
      where: {
        reason: "shipment_stock_commit",
        adjustedBy: `system:shipment_commit;order:${order.id}`,
      },
    });
    if (existingCommit) {
      logger.info(`[inventoryReservation] Stock already committed for order ${order.id}. Skipping.`);
      return;
    }

    for (const item of order.items) {
      const inv = await findItemInventory(tx, item);
      if (!inv) {
        logger.warn(`[inventoryReservation] No inventory record found to commit for item ${item.id}`);
        continue;
      }

      const nextStock = Math.max(0, inv.stock - item.quantity);
      const nextReservedStock = Math.max(0, inv.reservedStock - item.quantity);

      await tx.inventory.update({
        where: { id: inv.id },
        data: {
          stock: nextStock,
          reservedStock: nextReservedStock,
        },
      });

      await tx.inventoryAdjustment.create({
        data: {
          inventoryId: inv.id,
          variantId: item.variantId ?? null,
          previousQty: inv.stock,
          newQty: nextStock,
          reason: "shipment_stock_commit",
          adjustedBy: `system:shipment_commit;order:${order.id}`,
        },
      });
    }

    logger.info(`[inventoryReservation] Successfully committed stock upon shipment for order ${order.id}`);
  });
}

/**
 * 3. RELEASE RESERVATION (Invoked upon Payment Failure / Expiration / Pre-Shipment Cancellation)
 * - stock: UNCHANGED
 * - reservedStock: -= quantity (clamped at 0)
 * - Idempotent: Skips if already released or if stock was already committed upon shipment.
 */
export async function releaseOrderReservation(
  orderId: string,
  txClient?: Prisma.TransactionClient
): Promise<void> {
  await withTx(txClient, async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order || !order.items.length) return;

    // Cannot release reservation if order was already committed/shipped
    const wasCommitted = await tx.inventoryAdjustment.findFirst({
      where: {
        reason: "shipment_stock_commit",
        adjustedBy: `system:shipment_commit;order:${order.id}`,
      },
    });
    if (wasCommitted) {
      logger.warn(`[inventoryReservation] Order ${order.id} was already shipped/committed. Cannot release reservation.`);
      return;
    }

    // Idempotency check: verify if already released
    const existingRelease = await tx.inventoryAdjustment.findFirst({
      where: {
        reason: "payment_reservation_release",
        adjustedBy: `system:reservation_release;order:${order.id}`,
      },
    });
    if (existingRelease) {
      logger.info(`[inventoryReservation] Reservation for order ${order.id} was already released. Skipping.`);
      return;
    }

    for (const item of order.items) {
      const inv = await findItemInventory(tx, item);
      if (!inv) {
        logger.warn(`[inventoryReservation] No inventory record found to release reservation for item ${item.id}`);
        continue;
      }

      const nextReservedStock = Math.max(0, inv.reservedStock - item.quantity);

      await tx.inventory.update({
        where: { id: inv.id },
        data: { reservedStock: nextReservedStock },
      });

      await tx.inventoryAdjustment.create({
        data: {
          inventoryId: inv.id,
          variantId: item.variantId ?? null,
          previousQty: inv.reservedStock,
          newQty: nextReservedStock,
          reason: "payment_reservation_release",
          adjustedBy: `system:reservation_release;order:${order.id}`,
        },
      });
    }

    logger.info(`[inventoryReservation] Successfully released reservation for order ${order.id}`);
  });
}
