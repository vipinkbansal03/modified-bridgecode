import { prisma } from "../../config/database";
import { AppError, getPagination } from "../../utils/apiResponse";
import type { InventoryStatus, Prisma } from "@prisma/client";

type InventoryClient = typeof prisma | Prisma.TransactionClient;

export async function listInventory(query: { page?: string; limit?: string; search?: string }) {
  const { page, limit, skip } = getPagination(query);
  const [data, total] = await Promise.all([
    prisma.inventory.findMany({
      skip, take: limit,
      include: { variant: { include: { product: { select: { id: true, title: true, sku: true } } } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.inventory.count(),
  ]);
  return { data, total, page, limit };
}

export function getInventoryStatus(stock: number, lowStockThreshold: number): InventoryStatus {
  if (stock <= 0) return "OUT_OF_STOCK";
  if (stock <= lowStockThreshold) return "LOW_STOCK";
  return "IN_STOCK";
}

function adjustmentInclude() {
  return {
    inventory: true,
    variant: {
      include: {
        product: { select: { id: true, title: true, sku: true } },
      },
    },
  } satisfies Prisma.InventoryAdjustmentInclude;
}

export async function listInventoryAdjustments(query: {
  page?: string;
  limit?: string;
  reason?: string;
  startDate?: string;
  endDate?: string;
}) {
  const { page, limit, skip } = getPagination(query);
  const where: Prisma.InventoryAdjustmentWhereInput = {};

  if (query.reason) where.reason = query.reason;
  if (query.startDate || query.endDate) {
    where.createdAt = {
      ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
      ...(query.endDate ? { lte: new Date(query.endDate) } : {}),
    };
  }

  const [data, total] = await Promise.all([
    prisma.inventoryAdjustment.findMany({
      where,
      skip,
      take: limit,
      include: adjustmentInclude(),
      orderBy: { createdAt: "desc" },
    }),
    prisma.inventoryAdjustment.count({ where }),
  ]);

  return { data, total, page, limit };
}

export async function listVariantInventoryAdjustments(
  variantId: string,
  query: { page?: string; limit?: string }
) {
  const variant = await prisma.productVariant.findUnique({ where: { id: variantId }, select: { id: true } });
  if (!variant) throw new AppError("Variant not found.", 404);

  const { page, limit, skip } = getPagination(query);
  const where: Prisma.InventoryAdjustmentWhereInput = { variantId };
  const [data, total] = await Promise.all([
    prisma.inventoryAdjustment.findMany({
      where,
      skip,
      take: limit,
      include: adjustmentInclude(),
      orderBy: { createdAt: "desc" },
    }),
    prisma.inventoryAdjustment.count({ where }),
  ]);

  return { data, total, page, limit };
}

export async function updateInventory(id: string, data: { stock?: number; reservedStock?: number; lowStockThreshold?: number; status?: string }) {
  const existing = await prisma.inventory.findUnique({ where: { id } });
  if (!existing) return prisma.inventory.update({ where: { id }, data: data as never });

  const nextStock = data.stock ?? existing.stock;
  const nextLowStockThreshold = data.lowStockThreshold ?? existing.lowStockThreshold;
  const shouldRecalculateStatus = data.stock !== undefined || data.lowStockThreshold !== undefined;
  const updated = await prisma.inventory.update({
    where: { id },
    data: {
      ...data,
      ...(shouldRecalculateStatus ? { status: getInventoryStatus(nextStock, nextLowStockThreshold) } : {}),
    } as never,
  });

  if (data.stock !== undefined && data.stock !== existing.stock) {
    await prisma.inventoryAdjustment.create({
      data: {
        inventoryId: existing.id,
        variantId: existing.variantId,
        previousQty: existing.stock,
        newQty: data.stock,
        reason: "manual_update",
      },
    });
  }

  return updated;
}

export async function decrementVariantStock(
  variantId: string,
  quantity: number,
  meta: { reason?: string; adjustedBy?: string } = {},
  client: InventoryClient = prisma
) {
  const existing = await client.inventory.findUnique({ where: { variantId } });
  if (!existing) return null;

  const nextStock = existing.stock - quantity;
  const updated = await client.inventory.update({
    where: { id: existing.id },
    data: {
      stock: nextStock,
      status: getInventoryStatus(nextStock, existing.lowStockThreshold),
    },
  });

  await client.inventoryAdjustment.create({
    data: {
      inventoryId: existing.id,
      variantId,
      previousQty: existing.stock,
      newQty: nextStock,
      reason: meta.reason,
      adjustedBy: meta.adjustedBy,
    },
  });

  return updated;
}

export async function setVariantStock(
  variantId: string,
  stock: number,
  meta: { reason?: string; adjustedBy?: string } = {},
  client: InventoryClient = prisma
) {
  const existing = await client.inventory.findUnique({ where: { variantId } });
  if (!existing) return null;

  const updated = await client.inventory.update({
    where: { id: existing.id },
    data: {
      stock,
      status: getInventoryStatus(stock, existing.lowStockThreshold),
    },
  });

  if (stock !== existing.stock) {
    await client.inventoryAdjustment.create({
      data: {
        inventoryId: existing.id,
        variantId,
        previousQty: existing.stock,
        newQty: stock,
        reason: meta.reason,
        adjustedBy: meta.adjustedBy,
      },
    });
  }

  return updated;
}

export async function getLowStockAlerts() {
  return prisma.inventory.findMany({
    where: { OR: [{ status: "LOW_STOCK" }, { status: "OUT_OF_STOCK" }] },
    include: { variant: { include: { product: { select: { id: true, title: true } } } } },
  });
}
