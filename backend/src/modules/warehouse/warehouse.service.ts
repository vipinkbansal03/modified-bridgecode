import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { AppError, getPagination } from "../../utils/apiResponse";

function validateGstin(countryCode: string, gstin?: string | null) {
  if (countryCode.toUpperCase() === "IN") {
    if (!gstin || !gstin.trim()) return false;
    // Basic GSTIN format: 15 chars, alphanumeric
    if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin.trim())) {
      return false;
    }
  }
  return true;
}

export async function listWarehouses(query: {
  page?: string;
  limit?: string;
  search?: string;
  requestingUserId?: string;
  deleted?: string;
}) {
  const { page, limit, skip } = getPagination(query);
  const where: Prisma.WarehouseWhereInput = {};

  if (query.deleted === "true") {
    where.deletedAt = { not: null };
  } else {
    where.deletedAt = null;
  }

  if (query.search?.trim()) {
    where.OR = [
      { name: { contains: query.search.trim(), mode: "insensitive" } },
      { gstin: { contains: query.search.trim(), mode: "insensitive" } },
    ];
  }

  if (query.requestingUserId) {
    const user = await prisma.user.findUnique({
      where: { id: query.requestingUserId },
      include: { role: true }
    });
    if (user && !["Super Admin", "Admin"].includes(user.role.name)) {
      const userWarehouses = await prisma.userWarehouse.findMany({
        where: { userId: query.requestingUserId },
        select: { warehouseId: true }
      });
      if (userWarehouses.length > 0) {
        const allowedIds = userWarehouses.map((uw) => uw.warehouseId);
        where.id = { in: allowedIds };
      }
    }
  }

  const [rawWarehouses, total] = await Promise.all([
    prisma.warehouse.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { country: true }
    }),
    prisma.warehouse.count({ where }),
  ]);

  if (rawWarehouses.length === 0) {
    return { data: [], total, page, limit };
  }

  const warehouseIds = rawWarehouses.map((w) => w.id);

  // Batch query all protected dependencies in parallel
  const [ordersGroupBy, orderItemsGroupBy, shipmentsGroupBy, inventoriesWithAdjustments] = await Promise.all([
    prisma.order.groupBy({
      by: ["warehouseId"],
      where: { warehouseId: { in: warehouseIds } },
      _count: { _all: true },
    }),
    prisma.orderItem.groupBy({
      by: ["warehouseId"],
      where: { warehouseId: { in: warehouseIds } },
      _count: { _all: true },
    }),
    prisma.shipment.groupBy({
      by: ["warehouseId"],
      where: { warehouseId: { in: warehouseIds } },
      _count: { _all: true },
    }),
    prisma.inventory.findMany({
      where: { warehouseId: { in: warehouseIds } },
      select: {
        warehouseId: true,
        stock: true,
        _count: { select: { adjustments: true } },
      },
    }),
  ]);

  const ordersCountMap = new Map<string, number>();
  ordersGroupBy.forEach((g) => {
    if (g.warehouseId) ordersCountMap.set(g.warehouseId, g._count._all);
  });

  const orderItemsCountMap = new Map<string, number>();
  orderItemsGroupBy.forEach((g) => {
    if (g.warehouseId) orderItemsCountMap.set(g.warehouseId, g._count._all);
  });

  const shipmentsCountMap = new Map<string, number>();
  shipmentsGroupBy.forEach((g) => {
    if (g.warehouseId) shipmentsCountMap.set(g.warehouseId, g._count._all);
  });

  const inventoriesCountMap = new Map<string, number>();
  const activeStockMap = new Map<string, number>();
  const adjustmentsCountMap = new Map<string, number>();

  for (const inv of inventoriesWithAdjustments) {
    if (!inv.warehouseId) continue;
    inventoriesCountMap.set(inv.warehouseId, (inventoriesCountMap.get(inv.warehouseId) || 0) + 1);
    activeStockMap.set(inv.warehouseId, (activeStockMap.get(inv.warehouseId) || 0) + Math.max(0, inv.stock || 0));
    adjustmentsCountMap.set(inv.warehouseId, (adjustmentsCountMap.get(inv.warehouseId) || 0) + (inv._count?.adjustments || 0));
  }

  const data = rawWarehouses.map((w) => {
    const ordersCount = ordersCountMap.get(w.id) || 0;
    const orderItemsCount = orderItemsCountMap.get(w.id) || 0;
    const shipmentsCount = shipmentsCountMap.get(w.id) || 0;
    const inventoriesCount = inventoriesCountMap.get(w.id) || 0;
    const activeStock = activeStockMap.get(w.id) || 0;
    const adjustmentsCount = adjustmentsCountMap.get(w.id) || 0;

    let canPermanentDelete = true;
    let permanentDeleteBlockReason: string | null = null;

    if (ordersCount > 0) {
      canPermanentDelete = false;
      permanentDeleteBlockReason = "Permanent deletion is not allowed because this warehouse is referenced by historical orders and legal tax invoices.";
    } else if (orderItemsCount > 0) {
      canPermanentDelete = false;
      permanentDeleteBlockReason = "Permanent deletion is not allowed because this warehouse is referenced by historical order items.";
    } else if (shipmentsCount > 0) {
      canPermanentDelete = false;
      permanentDeleteBlockReason = "Permanent deletion is not allowed because this warehouse is referenced by historical shipments and courier manifests.";
    } else if (activeStock > 0) {
      canPermanentDelete = false;
      permanentDeleteBlockReason = `Permanent deletion is not allowed while active stock (${activeStock} units) is assigned to this warehouse. Transfer or zero the inventory first.`;
    } else if (adjustmentsCount > 0) {
      canPermanentDelete = false;
      permanentDeleteBlockReason = "Permanent deletion is not allowed because historical stock adjustment audit logs exist for this warehouse.";
    }

    return {
      ...w,
      dependencyCounts: {
        orders: ordersCount,
        orderItems: orderItemsCount,
        shipments: shipmentsCount,
        inventories: inventoriesCount,
        activeStock,
        adjustments: adjustmentsCount,
      },
      _count: {
        orders: ordersCount,
        orderItems: orderItemsCount,
        shipments: shipmentsCount,
        inventories: inventoriesCount,
      },
      canPermanentDelete,
      permanentDeleteBlockReason,
    };
  });

  return { data, total, page, limit };
}

export async function createWarehouse(data: {
  name: string;
  countryId: string;
  state?: string;
  address?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  postalCode?: string;
  gstin?: string;
  deliveryZones?: { countryId: string; states: string[] }[];
  status: any;
}) {
  const country = await prisma.country.findUnique({ where: { id: data.countryId } });
  if (!country) throw new AppError("Country not found.", 404);

  if (data.status === "ACTIVE" && country.code === "IN" && data.gstin && !validateGstin(country.code, data.gstin)) {
    throw new AppError("The provided GSTIN format is invalid.", 400);
  }

  const formattedAddress = data.address || [
    data.addressLine1,
    data.addressLine2,
    data.city,
    data.postalCode
  ].filter(Boolean).join(", ");

  return prisma.warehouse.create({ data: {
    name: data.name,
    countryId: data.countryId,
    status: data.status,
    state: data.state ?? "",
    address: formattedAddress,
    addressLine1: data.addressLine1 ?? null,
    addressLine2: data.addressLine2 ?? null,
    city: data.city ?? null,
    postalCode: data.postalCode ?? null,
    gstin: data.gstin ?? "",
    deliveryZones: data.deliveryZones ? JSON.parse(JSON.stringify(data.deliveryZones)) : []
  } });
}

export async function updateWarehouse(id: string, data: {
  name?: string;
  countryId?: string;
  state?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  postalCode?: string;
  gstin?: string;
  deliveryZones?: { countryId: string; states: string[] }[];
  status?: any;
}) {
  const existing = await prisma.warehouse.findUnique({
    where: { id },
    include: { country: true }
  });
  if (!existing) throw new AppError("Warehouse not found.", 404);

  let targetCountry = existing.country;
  if (data.countryId && data.countryId !== existing.countryId) {
    const c = await prisma.country.findUnique({ where: { id: data.countryId } });
    if (!c) throw new AppError("Country not found.", 404);
    targetCountry = c;
  }

  const nextStatus = data.status ?? existing.status;
  const nextGstin = data.gstin ?? existing.gstin;

  if (nextStatus === "ACTIVE" && targetCountry.code === "IN" && nextGstin && !validateGstin(targetCountry.code, nextGstin)) {
    throw new AppError("The provided GSTIN format is invalid.", 400);
  }

  const nextLine1 = data.addressLine1 !== undefined ? data.addressLine1 : existing.addressLine1;
  const nextLine2 = data.addressLine2 !== undefined ? data.addressLine2 : existing.addressLine2;
  const nextCity = data.city !== undefined ? data.city : existing.city;
  const nextPostalCode = data.postalCode !== undefined ? data.postalCode : existing.postalCode;
  
  const formattedAddress = [nextLine1, nextLine2, nextCity, nextPostalCode].filter(Boolean).join(", ");

  return prisma.warehouse.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.countryId && { countryId: data.countryId }),
      ...(data.state !== undefined && { state: data.state }),
      ...(data.addressLine1 !== undefined && { addressLine1: data.addressLine1 }),
      ...(data.addressLine2 !== undefined && { addressLine2: data.addressLine2 }),
      ...(data.city !== undefined && { city: data.city }),
      ...(data.postalCode !== undefined && { postalCode: data.postalCode }),
      ...(data.gstin !== undefined && { gstin: data.gstin }),
      ...(data.deliveryZones !== undefined && { deliveryZones: data.deliveryZones ? JSON.parse(JSON.stringify(data.deliveryZones)) : [] }),
      ...(data.status && { status: data.status }),
      address: formattedAddress,
    }
  });
}

export async function deleteWarehouse(id: string) {
  const existing = await prisma.warehouse.findUnique({ where: { id } });
  if (!existing) throw new AppError("Warehouse not found.", 404);
  if (existing.deletedAt) throw new AppError("Warehouse is already archived.", 400);

  return prisma.warehouse.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      status: "INACTIVE",
    },
  });
}

export async function restoreWarehouse(id: string) {
  const existing = await prisma.warehouse.findUnique({ where: { id } });
  if (!existing) throw new AppError("Warehouse not found.", 404);
  if (!existing.deletedAt) throw new AppError("Warehouse is not archived.", 400);

  return prisma.warehouse.update({
    where: { id },
    data: {
      deletedAt: null,
      status: "INACTIVE", // Crucial safeguard: restored as INACTIVE, must be explicitly reviewed and enabled
    },
  });
}

export async function permanentDeleteWarehouse(id: string) {
  const existing = await prisma.warehouse.findUnique({ where: { id } });
  if (!existing) throw new AppError("Warehouse not found.", 404);

  // Check 1: Orders
  const ordersCount = await prisma.order.count({ where: { warehouseId: id } });
  if (ordersCount > 0) {
    throw new AppError(
      "Cannot permanently delete warehouse: It is referenced by historical orders and legal tax invoices.",
      400
    );
  }

  // Check 2: Order Items
  const orderItemsCount = await prisma.orderItem.count({ where: { warehouseId: id } });
  if (orderItemsCount > 0) {
    throw new AppError(
      "Cannot permanently delete warehouse: It is referenced by historical order items.",
      400
    );
  }

  // Check 3: Shipments
  const shipmentsCount = await prisma.shipment.count({ where: { warehouseId: id } });
  if (shipmentsCount > 0) {
    throw new AppError(
      "Cannot permanently delete warehouse: It is referenced by historical shipments and courier manifests.",
      400
    );
  }

  // Check 4: Active Stock (> 0)
  const activeStockInv = await prisma.inventory.findFirst({
    where: { warehouseId: id, stock: { gt: 0 } },
  });
  if (activeStockInv) {
    throw new AppError(
      "Cannot permanently delete warehouse: Active stock is currently assigned to this facility. Transfer or zero inventory first.",
      400
    );
  }

  // Check 5: Inventory Adjustments Audit History
  const adjustmentsCount = await prisma.inventoryAdjustment.count({
    where: { inventory: { warehouseId: id } },
  });
  if (adjustmentsCount > 0) {
    throw new AppError(
      "Cannot permanently delete warehouse: Stock adjustment audit records exist for this facility.",
      400
    );
  }

  // If all dependencies are zero, clean up any remaining 0-stock / 0-adjustment placeholder inventory rows and physically delete warehouse
  return prisma.$transaction(async (tx) => {
    await tx.inventory.deleteMany({ where: { warehouseId: id } });
    return tx.warehouse.delete({ where: { id } });
  });
}

export async function bulkPermanentDeleteWarehouses(ids: string[]) {
  const deletedIds: string[] = [];
  const blocked: Array<{ id: string; name: string; reason: string }> = [];

  for (const id of ids) {
    try {
      const wh = await prisma.warehouse.findUnique({
        where: { id },
        select: { id: true, name: true },
      });
      if (!wh) {
        blocked.push({ id, name: id, reason: "Warehouse not found." });
        continue;
      }
      await permanentDeleteWarehouse(id);
      deletedIds.push(id);
    } catch (error: any) {
      const wh = await prisma.warehouse.findUnique({
        where: { id },
        select: { name: true },
      });
      blocked.push({
        id,
        name: wh?.name || id,
        reason: error?.message || "Failed to permanently delete warehouse.",
      });
    }
  }

  return {
    deletedCount: deletedIds.length,
    blockedCount: blocked.length,
    deletedIds,
    blocked,
  };
}

