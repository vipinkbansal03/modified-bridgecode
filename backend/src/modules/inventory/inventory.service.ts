import { InventoryStatus, Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { AppError, getPagination } from "../../utils/apiResponse";
import { readSpreadsheetRows, writeSpreadsheetBuffer } from "../../utils/spreadsheet";

type InventoryClient = typeof prisma | Prisma.TransactionClient;

type InventoryListQuery = {
  page?: string;
  limit?: string;
  search?: string;
  status?: string;
  warehouseId?: string;
  productId?: string;
  variantId?: string;
  sortBy?: string;
  sortDir?: string;
  requestingUserId?: string;
  fromDate?: string;
  toDate?: string;
  startDate?: string;
  endDate?: string;
};

type InventoryBulkUpdateInput = {
  ids?: string[];
  stock?: number | string;
  lowStockThreshold?: number | string;
  adjustedBy?: string;
  warehouseId?: string | null;
};

type InventoryImportRow = {
  variantId?: string;
  variantSku?: string;
  productSku?: string;
  warehouseId?: string;
  stock?: string;
  reservedStock?: string;
  lowStockThreshold?: string;
};

const INVENTORY_EXPORT_COLUMNS = [
  { key: "productTitle", header: "productTitle" },
  { key: "productSku", header: "productSku" },
  { key: "variantTitle", header: "variantTitle" },
  { key: "variantSku", header: "variantSku" },
  { key: "warehouseId", header: "warehouseId" },
  { key: "scope", header: "scope" },
  { key: "stock", header: "stock" },
  { key: "reservedStock", header: "reservedStock" },
  { key: "availableStock", header: "availableStock" },
  { key: "lowStockThreshold", header: "lowStockThreshold" },
  { key: "status", header: "status" },
] as const;

function inventoryInclude() {
  return {
    country: {
      select: {
        id: true,
        name: true,
        code: true,
      },
    },
    warehouse: {
      include: {
        country: true
      }
    },
    product: {
      select: {
        id: true,
        title: true,
        sku: true,
        brand: true,
        status: true,
        updatedAt: true,
        countries: {
          where: { enabled: true },
          include: { country: { select: { id: true, name: true, code: true } } },
        },
      },
    },
    variant: {
      include: {
        product: { select: { id: true, title: true, sku: true } },
      },
    },
  } satisfies Prisma.InventoryInclude;
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

function normalizeInventoryStatus(value?: string) {
  if (!value) return undefined;
  const normalized = value.trim().toUpperCase();
  return ["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK", "BACKORDER"].includes(normalized) ? (normalized as InventoryStatus) : undefined;
}

function parseOptionalInt(value: unknown, field: string) {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new AppError(`${field} must be an integer.`, 400);
  return parsed;
}

function parseNonNegativeInt(value: unknown, field: string) {
  const parsed = parseOptionalInt(value, field);
  if (parsed === undefined) return undefined;
  if (parsed < 0) throw new AppError(`${field} must be zero or a positive number.`, 400);
  return parsed;
}

function parseBooleanText(value: string | undefined) {
  return String(value ?? "").trim().toLowerCase() === "true";
}

async function buildInventoryWhere(query: InventoryListQuery): Promise<Prisma.InventoryWhereInput> {
  const where: Prisma.InventoryWhereInput = {
    product: { deletedAt: null }
  };
  const search = query.search?.trim();
  const status = normalizeInventoryStatus(query.status);

  if (search) {
    where.OR = [
      { product: { title: { contains: search, mode: "insensitive" } } },
      { product: { sku: { contains: search, mode: "insensitive" } } },
      { variant: { title: { contains: search, mode: "insensitive" } } },
      { variant: { sku: { contains: search, mode: "insensitive" } } },
      { warehouse: { name: { contains: search, mode: "insensitive" } } },
      { warehouse: { state: { contains: search, mode: "insensitive" } } },
    ];
  }

  if (status) {
    where.status = status;
  }

  if (query.productId) {
    const ids = query.productId.split(",").map((s) => s.trim()).filter(Boolean);
    if (ids.length > 1) {
      where.productId = { in: ids };
    } else if (ids.length === 1) {
      where.productId = ids[0];
    }
  }

  if (query.variantId) {
    const ids = query.variantId.split(",").map((s) => s.trim()).filter(Boolean);
    if (ids.length > 1) {
      where.variantId = { in: ids };
    } else if (ids.length === 1) {
      where.variantId = ids[0];
    }
  }

  const fromDate = query.fromDate || query.startDate;
  const toDate = query.toDate || query.endDate;
  if (fromDate || toDate) {
    where.updatedAt = {
      ...(fromDate ? { gte: new Date(fromDate) } : {}),
      ...(toDate ? { lte: new Date(new Date(toDate).setHours(23, 59, 59, 999)) } : {}),
    };
  }

  let allowedWarehouseIds: string[] | null = null;
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
        allowedWarehouseIds = userWarehouses.map((uw) => uw.warehouseId);
      }
    }
  }

  if (query.warehouseId) {
    if (allowedWarehouseIds) {
      if (allowedWarehouseIds.includes(query.warehouseId)) {
        where.warehouseId = query.warehouseId;
      } else {
        where.warehouseId = "none";
      }
    } else {
      where.warehouseId = query.warehouseId;
    }
  } else if (allowedWarehouseIds) {
    where.warehouseId = { in: allowedWarehouseIds };
  }

  return where;
}

function buildInventoryOrder(query: InventoryListQuery): Prisma.InventoryOrderByWithRelationInput[] {
  const dir = query.sortDir === "asc" ? "asc" : "desc";
  switch (query.sortBy) {
    case "stock":
      return [{ stock: dir }, { updatedAt: "desc" }];
    case "reservedStock":
      return [{ reservedStock: dir }, { updatedAt: "desc" }];
    case "lowStockThreshold":
      return [{ lowStockThreshold: dir }, { updatedAt: "desc" }];
    case "status":
      return [{ status: dir }, { updatedAt: "desc" }];
    case "product":
      return [{ product: { title: dir } }, { variant: { title: "asc" } }, { updatedAt: "desc" }];
    case "variant":
      return [{ variant: { title: dir } }, { product: { title: "asc" } }, { updatedAt: "desc" }];
    case "warehouse":
      return [{ warehouse: { name: dir } }, { updatedAt: "desc" }];
    case "sku":
      return [{ variant: { sku: dir } }, { product: { sku: dir } }, { updatedAt: "desc" }];
    case "updatedAt":
      return [{ updatedAt: dir }];
    default:
      return [{ updatedAt: "desc" }];
  }
}

export async function listInventory(query: InventoryListQuery) {
  const { page, limit, skip } = getPagination(query);
  const where = await buildInventoryWhere(query);
  const orderBy = buildInventoryOrder(query);

  if ((query as any).idsOnly === "true" || (query as any).idsOnly === true) {
    const ids = await prisma.inventory.findMany({
      where,
      select: { id: true },
      orderBy,
    });
    return { data: ids, total: ids.length, page: 1, limit: ids.length };
  }

  const [data, total] = await Promise.all([
    prisma.inventory.findMany({
      where,
      skip,
      take: limit,
      include: inventoryInclude(),
      orderBy,
    }),
    prisma.inventory.count({ where }),
  ]);

  return { data, total, page, limit };
}

export function getInventoryStatus(stock: number, lowStockThreshold: number): InventoryStatus {
  if (stock <= 0) return "OUT_OF_STOCK";
  if (stock <= lowStockThreshold) return "LOW_STOCK";
  return "IN_STOCK";
}

export async function getInventoryDashboard() {
  const [summary, lowStockDistinct, outOfStockDistinct, recentItems, recentAdjustments] = await Promise.all([
    prisma.inventory.aggregate({
      where: { product: { deletedAt: null } },
      _count: { id: true },
      _sum: { stock: true, reservedStock: true },
    }),
    prisma.inventory.findMany({
      where: { status: "LOW_STOCK", product: { deletedAt: null } },
      distinct: ["variantId"],
      select: { id: true },
    }),
    prisma.inventory.findMany({
      where: { status: "OUT_OF_STOCK", product: { deletedAt: null } },
      distinct: ["variantId"],
      select: { id: true },
    }),
    prisma.inventory.findMany({
      where: { product: { deletedAt: null } },
      take: 6,
      orderBy: { updatedAt: "desc" },
      include: inventoryInclude(),
    }),
    prisma.inventoryAdjustment.findMany({
      where: { inventory: { product: { deletedAt: null } } },
      take: 8,
      orderBy: { createdAt: "desc" },
      include: adjustmentInclude(),
    }),
  ]);

  return {
    totals: {
      trackedItems: summary._count.id ?? 0,
      totalStock: summary._sum.stock ?? 0,
      reservedStock: summary._sum.reservedStock ?? 0,
      lowStockCount: lowStockDistinct.length,
      outOfStockCount: outOfStockDistinct.length,
    },
    recentItems,
    recentAdjustments,
  };
}

export async function listInventoryAdjustments(query: {
  page?: string;
  limit?: string;
  reason?: string;
  startDate?: string;
  endDate?: string;
}) {
  const { page, limit, skip } = getPagination(query);
  const where: Prisma.InventoryAdjustmentWhereInput = {
    inventory: { product: { deletedAt: null } }
  };

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

export async function listVariantInventoryAdjustments(variantId: string, query: { page?: string; limit?: string }) {
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

async function createAdjustment(
  client: InventoryClient,
  inventoryId: string,
  variantId: string | null,
  previousQty: number,
  newQty: number,
  reason?: string,
  adjustedBy?: string,
) {
  await client.inventoryAdjustment.create({
    data: {
      inventoryId,
      variantId,
      previousQty,
      newQty,
      reason,
      adjustedBy,
    },
  });
}

async function findVariantInventoryRecord(
  client: InventoryClient,
  variantId: string,
  warehouseId?: string | null,
) {
  if (warehouseId) {
    const override = await client.inventory.findFirst({
      where: { variantId, warehouseId },
    });
    if (override) return override;
  }

  return client.inventory.findFirst({
    where: { variantId, warehouseId: null },
  });
}

async function ensureVariantInventoryRecord(
  client: InventoryClient,
  variantId: string,
  warehouseId?: string | null,
) {
  let existing = await client.inventory.findFirst({
    where: { variantId, warehouseId: warehouseId ?? null },
  });
  if (existing) return existing;

  const variant = await client.productVariant.findUnique({
    where: { id: variantId },
    select: { id: true, productId: true },
  });
  if (!variant) return null;

  try {
    return await client.inventory.create({
      data: {
        productId: variant.productId,
        variantId,
        warehouseId: warehouseId ?? null,
        stock: 0,
        reservedStock: 0,
        lowStockThreshold: 10,
        status: "OUT_OF_STOCK",
      },
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      existing = await client.inventory.findFirst({
        where: { variantId, warehouseId: warehouseId ?? null },
      });
      if (existing) return existing;
    }
    throw error;
  }
}

export async function upsertVariantInventory(data: {
  variantId: string;
  warehouseId?: string | null;
  stock: number;
  lowStockThreshold?: number;
}) {
  if (!data.variantId) throw new AppError("variantId is required.", 400);
  if (!Number.isInteger(data.stock) || data.stock < 0) throw new AppError("Stock must be a non-negative integer.", 400);
  if (data.lowStockThreshold !== undefined && (!Number.isInteger(data.lowStockThreshold) || data.lowStockThreshold < 0)) {
    throw new AppError("Low stock threshold must be a non-negative integer.", 400);
  }

  const variant = await prisma.productVariant.findUnique({
    where: { id: data.variantId },
    select: { id: true, productId: true },
  });
  if (!variant) throw new AppError("Variant not found.", 404);

  if (data.warehouseId) {
    const warehouse = await prisma.warehouse.findUnique({ where: { id: data.warehouseId }, select: { id: true } });
    if (!warehouse) throw new AppError("Warehouse not found.", 404);
  }

  const existing = await ensureVariantInventoryRecord(prisma, data.variantId, data.warehouseId ?? null);
  if (!existing) throw new AppError("Unable to create inventory record.", 500);

  return updateInventory(existing.id, {
    stock: data.stock,
    ...(data.lowStockThreshold !== undefined ? { lowStockThreshold: data.lowStockThreshold } : {}),
  });
}

export async function updateInventory(
  id: string,
  data: { stock?: number; reservedStock?: number; lowStockThreshold?: number; status?: string; warehouseId?: string | null },
  client: InventoryClient = prisma,
) {
  const existing = await client.inventory.findUnique({ where: { id } });
  if (!existing) throw new AppError("Inventory record not found.", 404);

  if (data.stock !== undefined && data.stock < 0) throw new AppError("Stock cannot be negative.", 400);
  if (data.reservedStock !== undefined && data.reservedStock < 0) throw new AppError("Reserved stock cannot be negative.", 400);
  if (data.lowStockThreshold !== undefined && data.lowStockThreshold < 0) throw new AppError("Low stock threshold cannot be negative.", 400);

  const nextStock = data.stock ?? existing.stock;
  let nextReservedStock = data.reservedStock ?? existing.reservedStock;
  const nextLowStockThreshold = data.lowStockThreshold ?? existing.lowStockThreshold;

  if (data.stock !== undefined && nextReservedStock > nextStock) {
    if (data.reservedStock === undefined) {
      nextReservedStock = nextStock;
      data.reservedStock = nextStock;
    } else {
      throw new AppError("Reserved stock cannot exceed stock.", 400);
    }
  } else if (nextReservedStock > nextStock) {
    throw new AppError("Reserved stock cannot exceed stock.", 400);
  }
  const shouldRecalculateStatus = data.stock !== undefined || data.reservedStock !== undefined || data.lowStockThreshold !== undefined;
  
  let updated;
  try {
    updated = await client.inventory.update({
      where: { id },
      data: {
        ...data,
        ...(shouldRecalculateStatus ? { status: getInventoryStatus(nextStock - nextReservedStock, nextLowStockThreshold) } : {}),
      } as never,
    });
  } catch (error: any) {
    if (error.code === 'P2002') {
      throw new AppError("Item already exists in that warehouse.", 400);
    }
    throw error;
  }

  if (data.stock !== undefined && data.stock !== existing.stock) {
    await createAdjustment(client, existing.id, existing.variantId, existing.stock, data.stock, "manual_update");
  }

  return updated;
}

export async function upsertProductInventory(
  productId: string,
  data: { warehouseId?: string | null; stock?: number; reservedStock?: number; lowStockThreshold?: number },
) {
  const product = await prisma.product.findFirst({ where: { id: productId, deletedAt: null }, select: { id: true } });
  if (!product) throw new AppError("Product not found.", 404);

  const warehouseId = data.warehouseId ?? null;
  if (warehouseId) {
    const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId }, select: { id: true } });
    if (!warehouse) throw new AppError("Warehouse not found.", 404);
  }

  const stock = Math.trunc(Number(data.stock ?? 0));
  let reservedStock = Math.trunc(Number(data.reservedStock ?? 0));
  const lowStockThreshold = Math.trunc(Number(data.lowStockThreshold ?? 10));
  if (![stock, reservedStock, lowStockThreshold].every(Number.isFinite) || stock < 0 || reservedStock < 0 || lowStockThreshold < 0) {
    throw new AppError("Inventory values must be valid non-negative numbers.", 400);
  }
  if (data.reservedStock === undefined) {
    reservedStock = Math.min(reservedStock, stock);
  } else if (reservedStock > stock) {
    throw new AppError("Reserved stock cannot exceed stock.", 400);
  }

  const existing = await prisma.inventory.findFirst({ where: { productId, variantId: null, warehouseId } });
  if (existing) return updateInventory(existing.id, { stock, reservedStock, lowStockThreshold });

  return prisma.inventory.create({
    data: {
      productId,
      variantId: null,
      warehouseId,
      stock,
      reservedStock,
      lowStockThreshold,
      status: getInventoryStatus(stock - reservedStock, lowStockThreshold),
    },
    include: { country: true },
  });
}

export async function bulkUpdateInventory(input: InventoryBulkUpdateInput) {
  if (!Array.isArray(input.ids) || input.ids.length === 0) {
    throw new AppError("Select at least one inventory item.", 400);
  }

  const stock = parseNonNegativeInt(input.stock, "Stock");
  const lowStockThreshold = parseNonNegativeInt(input.lowStockThreshold, "Low stock threshold");
  const warehouseId = input.warehouseId;
  if (stock === undefined && lowStockThreshold === undefined && warehouseId === undefined) {
    throw new AppError("Provide stock, low stock threshold, or warehouse to update.", 400);
  }

  const uniqueIds = Array.from(new Set(input.ids));
  const rows = await prisma.inventory.findMany({ where: { id: { in: uniqueIds } } });
  if (rows.length !== uniqueIds.length) {
    const foundIds = new Set(rows.map((row) => row.id));
    const missing = uniqueIds.filter((rowId) => !foundIds.has(rowId));
    throw new AppError(`Inventory not found for: ${missing.join(", ")}`, 404);
  }

  const results = uniqueIds.map((id) => ({ id, success: false as boolean, error: undefined as string | undefined }));

  const BATCH_SIZE = 100;
  for (let i = 0; i < uniqueIds.length; i += BATCH_SIZE) {
    const chunk = uniqueIds.slice(i, i + BATCH_SIZE);
    await prisma.$transaction(
      async (tx) => {
        for (const id of chunk) {
          const index = uniqueIds.indexOf(id);
          try {
            await updateInventory(
              id,
              {
                ...(stock !== undefined ? { stock } : {}),
                ...(lowStockThreshold !== undefined ? { lowStockThreshold } : {}),
                ...(warehouseId !== undefined ? { warehouseId } : {}),
              },
              tx,
            );
            results[index].success = true;
          } catch (error) {
            results[index].error = error instanceof Error ? error.message : "Failed to update inventory.";
          }
        }
      },
      { timeout: 30000 }
    );
  }

  return {
    results,
    summary: {
      total: uniqueIds.length,
      succeeded: results.filter((result) => result.success).length,
      failed: results.filter((result) => !result.success).length,
    },
  };
}

export async function decrementVariantStock(
  variantId: string,
  quantity: number,
  warehouseIdOrMeta: string | { reason?: string; adjustedBy?: string } | null = {},
  metaOrClient: { reason?: string; adjustedBy?: string } | InventoryClient = {},
  client: InventoryClient = prisma,
) {
  const warehouseId = typeof warehouseIdOrMeta === "string" || warehouseIdOrMeta === null ? warehouseIdOrMeta : undefined;
  const resolvedMeta: { reason?: string; adjustedBy?: string } =
    typeof warehouseIdOrMeta === "object" && warehouseIdOrMeta !== null && !("$transaction" in warehouseIdOrMeta)
      ? (warehouseIdOrMeta as { reason?: string; adjustedBy?: string })
      : typeof metaOrClient === "object" && metaOrClient !== null && !("$transaction" in metaOrClient)
        ? (metaOrClient as { reason?: string; adjustedBy?: string })
        : {};
  const resolvedClient = typeof metaOrClient === "object" && metaOrClient !== null && "$transaction" in metaOrClient ? metaOrClient : client;
  const existing = await findVariantInventoryRecord(resolvedClient, variantId, warehouseId);
  if (!existing) return null;

  const nextStock = existing.stock - quantity;
  const updated = await resolvedClient.inventory.update({
    where: { id: existing.id },
    data: {
      stock: nextStock,
      status: getInventoryStatus(nextStock, existing.lowStockThreshold),
    },
  });

  await createAdjustment(resolvedClient, existing.id, variantId, existing.stock, nextStock, resolvedMeta.reason, resolvedMeta.adjustedBy);

  return updated;
}

export async function setVariantStock(
  variantId: string,
  stock: number,
  warehouseIdOrMeta: string | { reason?: string; adjustedBy?: string } | null = {},
  metaOrClient: { reason?: string; adjustedBy?: string } | InventoryClient = {},
  client: InventoryClient = prisma,
) {
  const warehouseId = typeof warehouseIdOrMeta === "string" || warehouseIdOrMeta === null ? warehouseIdOrMeta : undefined;
  const resolvedMeta: { reason?: string; adjustedBy?: string } =
    typeof warehouseIdOrMeta === "object" && warehouseIdOrMeta !== null && !("$transaction" in warehouseIdOrMeta)
      ? (warehouseIdOrMeta as { reason?: string; adjustedBy?: string })
      : typeof metaOrClient === "object" && metaOrClient !== null && !("$transaction" in metaOrClient)
        ? (metaOrClient as { reason?: string; adjustedBy?: string })
        : {};
  const resolvedClient = typeof metaOrClient === "object" && metaOrClient !== null && "$transaction" in metaOrClient ? metaOrClient : client;
  const existing = await ensureVariantInventoryRecord(resolvedClient, variantId, warehouseId);
  if (!existing) return null;

  const updated = await resolvedClient.inventory.update({
    where: { id: existing.id },
    data: {
      stock,
      status: getInventoryStatus(stock, existing.lowStockThreshold),
    },
  });

  if (stock !== existing.stock) {
    await createAdjustment(resolvedClient, existing.id, variantId, existing.stock, stock, resolvedMeta.reason, resolvedMeta.adjustedBy);
  }

  return updated;
}

export async function getLowStockAlerts() {
  return prisma.inventory.findMany({
    where: {
      OR: [{ status: "LOW_STOCK" }, { status: "OUT_OF_STOCK" }],
      product: { deletedAt: null },
    },
    include: { product: { select: { id: true, title: true, sku: true } }, variant: { include: { product: { select: { id: true, title: true } } } } },
    orderBy: [{ updatedAt: "desc" }],
  });
}

function parseInventoryImportRow(row: Record<string, any>) {
  const safeStr = (v: any) => (v !== undefined && v !== null ? String(v).trim() : "");
  return {
    variantId: safeStr(row.variantId),
    variantSku: safeStr(row.variantSku),
    productSku: safeStr(row.productSku),
    warehouseId: safeStr(row.warehouseId).toUpperCase(),
    stock: safeStr(row.stock),
    reservedStock: safeStr(row.reservedStock),
    lowStockThreshold: safeStr(row.lowStockThreshold),
  };
}

async function previewInventoryImportRows(rows: Record<string, string>[]) {
  const parsedRows = rows.map(parseInventoryImportRow);
  const issues: Array<{ row: number; field: string; message: string }> = [];
  const duplicateWarnings: string[] = [];
  const seenIdentifiers = new Map<string, number>();

  for (const [index, row] of parsedRows.entries()) {
    const rowNumber = index + 2;
    const identifier = row.variantId || row.variantSku || row.productSku;
    if (!identifier) {
      issues.push({ row: rowNumber, field: "variantId", message: "Provide variantId or variantSku." });
      continue;
    }

    const seen = seenIdentifiers.get(identifier);
    if (seen) {
      const message = `Duplicate inventory identifier '${identifier}' found on rows ${seen} and ${rowNumber}.`;
      issues.push({ row: rowNumber, field: "variantId", message });
      duplicateWarnings.push(message);
    } else {
      seenIdentifiers.set(identifier, rowNumber);
    }

    const stock = row.stock === "" ? undefined : Number(row.stock);
    const reservedStock = row.reservedStock === "" ? undefined : Number(row.reservedStock);
    const lowStockThreshold = row.lowStockThreshold === "" ? undefined : Number(row.lowStockThreshold);

    if (stock !== undefined && (!Number.isInteger(stock) || stock < 0)) {
      issues.push({ row: rowNumber, field: "stock", message: "Stock must be a zero or positive integer." });
    }
    if (reservedStock !== undefined && (!Number.isInteger(reservedStock) || reservedStock < 0)) {
      issues.push({ row: rowNumber, field: "reservedStock", message: "Reserved stock must be a zero or positive integer." });
    }
    if (lowStockThreshold !== undefined && (!Number.isInteger(lowStockThreshold) || lowStockThreshold < 0)) {
      issues.push({ row: rowNumber, field: "lowStockThreshold", message: "Low stock threshold must be a zero or positive integer." });
    }
  }

  const variants = await prisma.productVariant.findMany({
    where: {
      OR: [
        ...(parsedRows.some((row) => row.variantId) ? [{ id: { in: parsedRows.map((row) => row.variantId).filter(Boolean) as string[] } }] : []),
        ...(parsedRows.some((row) => row.variantSku) ? [{ sku: { in: parsedRows.map((row) => row.variantSku).filter(Boolean) as string[] } }] : []),
        ...(parsedRows.some((row) => row.productSku) ? [{ product: { sku: { in: parsedRows.map((row) => row.productSku).filter(Boolean) as string[] } } }] : []),
      ],
    },
    include: {
      product: { select: { id: true, title: true, sku: true, status: true } },
      inventories: { where: { warehouseId: null }, take: 1 },
    },
  });

  const warehouseIds = Array.from(new Set(parsedRows.map((row) => row.warehouseId).filter(Boolean)));
  const countries = await prisma.country.findMany({
    where: warehouseIds.length ? { code: { in: warehouseIds } } : { id: "__never__" },
    select: { id: true, code: true },
  });
  const countryByCode = new Map(countries.map((country) => [country.code, country]));

  const variantById = new Map(variants.map((variant) => [variant.id, variant]));
  const variantBySku = new Map(variants.filter((variant) => variant.sku).map((variant) => [variant.sku as string, variant]));
  const variantsByProductSku = new Map<string, typeof variants[number]>();
  for (const variant of variants) {
    if (variant.product?.sku && !variantsByProductSku.has(variant.product.sku)) {
      variantsByProductSku.set(variant.product.sku, variant);
    }
  }

  for (const [index, row] of parsedRows.entries()) {
    const rowNumber = index + 2;
    const variant =
      (row.variantId ? variantById.get(row.variantId) : undefined) ||
      (row.variantSku ? variantBySku.get(row.variantSku) : undefined) ||
      (row.productSku ? variantsByProductSku.get(row.productSku) : undefined);

    if (!variant) {
      issues.push({ row: rowNumber, field: "variantId", message: "Variant not found." });
      continue;
    }

    if (variant.product.status === "ARCHIVED") {
      issues.push({ row: rowNumber, field: "variantId", message: "Variant belongs to an archived product." });
    }

    if (row.warehouseId && !countryByCode.has(row.warehouseId)) {
      issues.push({ row: rowNumber, field: "warehouseId", message: "Country code was not found." });
    }
  }

  return {
    rows: parsedRows,
    issues,
    duplicateWarnings,
    variants,
    variantById,
    variantBySku,
    variantsByProductSku,
    countryByCode,
  };
}

export async function previewInventoryImport(filePath: string) {
  const rows = readSpreadsheetRows(filePath);
  const preview = await previewInventoryImportRows(rows);
  return {
    totalRows: preview.rows.length,
    validRows: Math.max(0, preview.rows.length - preview.issues.length),
    invalidRows: preview.issues.length,
    issues: preview.issues,
    duplicateWarnings: preview.duplicateWarnings,
    sampleRows: preview.rows.slice(0, 10).map((row, index) => ({ row: index + 2, ...row })),
    rows: preview.rows.map((row, index) => {
      const rowNumber = index + 2;
      const rowIssues = preview.issues.filter((iss) => iss.row === rowNumber);
      return {
        ...row,
        rowNumber,
        isValid: rowIssues.length === 0,
        errors: rowIssues.map((iss) => (iss.field ? `[${iss.field}] ${iss.message}` : iss.message)),
      };
    }),
  };
}

export async function importInventorySpreadsheet(filePathOrRows: string | any[], adjustedBy?: string) {
  const rows = Array.isArray(filePathOrRows) ? filePathOrRows : readSpreadsheetRows(filePathOrRows);
  const preview = await previewInventoryImportRows(rows);
  if (typeof filePathOrRows === "string" && preview.issues.length > 0) {
    throw new AppError(`Import validation failed with ${preview.issues.length} issue(s).`, 400);
  }

  const summary = { created: 0, updated: 0 };
  const CHUNK_SIZE = 100;

  for (let i = 0; i < preview.rows.length; i += CHUNK_SIZE) {
    const chunk = preview.rows.slice(i, i + CHUNK_SIZE);
    await prisma.$transaction(async (tx) => {
      for (const [chunkIdx, row] of chunk.entries()) {
        const index = i + chunkIdx;
        const variant =
          (row.variantId ? preview.variantById.get(row.variantId) : undefined) ||
          (row.variantSku ? preview.variantBySku.get(row.variantSku) : undefined) ||
          (row.productSku ? preview.variantsByProductSku.get(row.productSku) : undefined);

        if (!variant) {
          throw new AppError(`Variant not found during import on row ${index + 2}.`, 400);
        }

        const warehouseId = row.warehouseId ? preview.countryByCode.get(row.warehouseId)?.id ?? null : null;
        const existing = await tx.inventory.findFirst({ where: { variantId: variant.id, warehouseId } });
        const baseInventory = variant.inventories[0];
        const stock = parseOptionalInt(row.stock, "Stock") ?? existing?.stock ?? baseInventory?.stock ?? 0;
        const reservedStock = parseOptionalInt(row.reservedStock, "Reserved stock") ?? existing?.reservedStock ?? baseInventory?.reservedStock ?? 0;
        const lowStockThreshold = parseOptionalInt(row.lowStockThreshold, "Low stock threshold") ?? existing?.lowStockThreshold ?? baseInventory?.lowStockThreshold ?? 10;
        if (stock < 0) throw new AppError("Stock cannot be negative.", 400);
        if (reservedStock < 0) throw new AppError("Reserved stock cannot be negative.", 400);
        if (lowStockThreshold < 0) throw new AppError("Low stock threshold cannot be negative.", 400);
        if (existing) {
          await tx.inventory.update({
            where: { id: existing.id },
            data: {
              stock,
              reservedStock,
              lowStockThreshold,
              status: getInventoryStatus(stock, lowStockThreshold),
            },
          });
          if (stock !== existing.stock) {
            await createAdjustment(tx, existing.id, variant.id, existing.stock, stock, "inventory_import");
          }
          summary.updated += 1;
        } else {
          const created = await tx.inventory.create({
            data: {
              productId: variant.productId,
              variantId: variant.id,
              warehouseId,
              stock,
              reservedStock,
              lowStockThreshold,
              status: getInventoryStatus(stock, lowStockThreshold),
            },
          });
          if (stock !== 0) {
            await createAdjustment(tx, created.id, variant.id, 0, stock, "inventory_import");
          }
          summary.created += 1;
        }
      }
    }, { timeout: 30000, maxWait: 10000 });
  }

  return {
    ...summary,
    report: {
      totalRows: preview.rows.length,
      validRows: preview.rows.length,
      invalidRows: 0,
      issues: [],
      duplicateWarnings: preview.duplicateWarnings,
      sampleRows: preview.rows.slice(0, 10).map((row, index) => ({ row: index + 2, ...row })),
    },
  };
}

function buildInventoryExportRow(inventory: Prisma.InventoryGetPayload<{ include: ReturnType<typeof inventoryInclude> }>) {
  const variant = inventory.variant;
  return {
    productTitle: inventory.product.title,
    productSku: inventory.product.sku ?? "",
    variantTitle: variant?.title ?? "",
    variantSku: variant?.sku ?? "",
    warehouseId: inventory.country?.code ?? "",
    scope: inventory.country ? "COUNTRY_OVERRIDE" : "BASE",
    stock: inventory.stock,
    reservedStock: inventory.reservedStock,
    availableStock: Math.max(0, inventory.stock - inventory.reservedStock),
    lowStockThreshold: inventory.lowStockThreshold,
    status: inventory.status,
  };
}

export async function exportInventorySpreadsheet(query: InventoryListQuery & { ids?: string }) {
  const ids = query.ids?.split(",").map((id) => id.trim()).filter(Boolean) ?? [];
  const where = ids.length
    ? { id: { in: ids } }
    : await buildInventoryWhere(query);

  const CHUNK_SIZE = 500;
  let offset = 0;
  const rows: ReturnType<typeof buildInventoryExportRow>[] = [];

  while (true) {
    const chunk = await prisma.inventory.findMany({
      where,
      orderBy: buildInventoryOrder(query),
      take: CHUNK_SIZE,
      skip: offset,
      include: inventoryInclude(),
    });

    if (chunk.length === 0) break;
    for (const inv of chunk) {
      rows.push(buildInventoryExportRow(inv));
    }
    if (chunk.length < CHUNK_SIZE) break;
    offset += chunk.length;
  }

  return writeSpreadsheetBuffer(
    rows,
    "Inventory",
    INVENTORY_EXPORT_COLUMNS.map((column) => ({ key: column.key, header: column.header })),
  );
}

export function generateSampleInventoryTemplate() {
  const sampleRows = [
    {
      productTitle: "Metal Bracket MBT .022",
      productSku: "PRD-MB-001",
      variantTitle: "MBT .022 Upper",
      variantSku: "VAR-MB-001-U",
      warehouseId: "DEFAULT",
      scope: "GLOBAL",
      stock: "150",
      reservedStock: "0",
      availableStock: "150",
      lowStockThreshold: "20",
      status: "ACTIVE",
    },
    {
      productTitle: "NiTi Archwire Upper .016",
      productSku: "PRD-NW-002",
      variantTitle: "Standard",
      variantSku: "VAR-NW-002-STD",
      warehouseId: "DEFAULT",
      scope: "GLOBAL",
      stock: "500",
      reservedStock: "10",
      availableStock: "490",
      lowStockThreshold: "50",
      status: "ACTIVE",
    },
  ];

  return writeSpreadsheetBuffer(
    sampleRows,
    "Inventory",
    INVENTORY_EXPORT_COLUMNS.map((column) => ({ key: column.key, header: column.header })),
  );
}



export async function deleteInventory(id: string, forceHardDelete: boolean = false) {
  const existing = await prisma.inventory.findUnique({
    where: { id },
    include: {
      product: { select: { id: true, title: true } },
      variant: { select: { id: true, sku: true, title: true } },
      warehouse: { select: { id: true, name: true } },
    },
  });
  if (!existing) throw new AppError("Inventory record not found.", 404);

  // Check for real active orders referencing this variant/product
  if (!forceHardDelete) {
    const activeOrderWhere: any = {
      order: {
        status: { in: ["PENDING", "CONFIRMED", "PROCESSING"] },
        deletedAt: null,
      },
    };

    if (existing.variantId) {
      activeOrderWhere.variantId = existing.variantId;
    } else {
      activeOrderWhere.productId = existing.productId;
    }

    if (existing.warehouseId) {
      activeOrderWhere.warehouseId = existing.warehouseId;
    }

    const activeOrderItems = await prisma.orderItem.findMany({
      where: activeOrderWhere,
      select: {
        orderId: true,
        quantity: true,
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            customer: { select: { firstName: true, lastName: true, email: true } },
          },
        },
      },
      take: 10,
    });

    if (activeOrderItems.length > 0) {
      const totalReservedInOrders = activeOrderItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
      const orderDetails = activeOrderItems
        .map((item) => {
          const custName = item.order?.customer
            ? `${item.order.customer.firstName} ${item.order.customer.lastName}`.trim() || item.order.customer.email
            : "Guest";
          return `• Order #${item.order?.orderNumber || item.orderId} (Status: ${item.order?.status}, Customer: ${custName}, Qty: ${item.quantity})`;
        })
        .join("\n");

      const itemLabel = existing.variant?.title || existing.variant?.sku || existing.product?.title || "Product";
      const whLabel = existing.warehouse?.name || "Default Warehouse";

      throw new AppError(
        `Cannot delete inventory record for "${itemLabel}" in warehouse "${whLabel}". ${totalReservedInOrders || existing.reservedStock} unit(s) are actively referenced in orders:\n${orderDetails}\n\nPlease fulfill or cancel these orders before deleting this inventory record.`,
        400,
      );
    }
  }

  // If no active orders exist or forceHardDelete is true, safely delete adjustments and inventory
  await prisma.$transaction(async (tx) => {
    await tx.inventoryAdjustment.deleteMany({ where: { inventoryId: id } });
    await tx.inventory.delete({ where: { id } });
  });
}

export async function bulkDeleteInventory(params: {
  ids?: string[];
  all?: boolean;
  forceHardDelete?: boolean;
}) {
  let targetIds: string[] = [];

  if (params.all) {
    let cursor: string | undefined = undefined;
    while (true) {
      const page: Array<{ id: string }> = await prisma.inventory.findMany({
        take: 5000,
        skip: cursor ? 1 : 0,
        cursor: cursor ? { id: cursor } : undefined,
        select: { id: true },
        orderBy: { id: "asc" },
      });
      if (!page.length) break;
      targetIds.push(...page.map((r) => r.id));
      cursor = page[page.length - 1].id;
      if (page.length < 5000) break;
    }
  } else if (Array.isArray(params.ids) && params.ids.length > 0) {
    targetIds = params.ids;
  }

  if (!targetIds.length) {
    return { deletedCount: 0, skippedCount: 0, skippedDetails: [] };
  }

  let deletedCount = 0;
  let skippedCount = 0;
  const skippedDetails: string[] = [];

  // Batch process in chunks of 500 to maintain optimal memory and database performance
  const CHUNK_SIZE = 500;
  for (let i = 0; i < targetIds.length; i += CHUNK_SIZE) {
    const chunkIds = targetIds.slice(i, i + CHUNK_SIZE);

    const records = await prisma.inventory.findMany({
      where: { id: { in: chunkIds } },
      select: {
        id: true,
        productId: true,
        variantId: true,
        warehouseId: true,
        reservedStock: true,
        product: { select: { title: true } },
        variant: { select: { sku: true, title: true } },
        warehouse: { select: { name: true } },
      },
    });

    if (!records.length) continue;

    const variantIds = records.map((r) => r.variantId).filter(Boolean) as string[];
    const productIds = records.map((r) => r.productId).filter(Boolean) as string[];

    let blockedInventoryIds = new Set<string>();

    if (!params.forceHardDelete && (variantIds.length > 0 || productIds.length > 0)) {
      const activeItems = await prisma.orderItem.findMany({
        where: {
          OR: [
            variantIds.length > 0 ? { variantId: { in: variantIds } } : undefined,
            productIds.length > 0 ? { productId: { in: productIds } } : undefined,
          ].filter(Boolean) as any,
          order: {
            status: { in: ["PENDING", "CONFIRMED", "PROCESSING"] },
            deletedAt: null,
          },
        },
        select: {
          variantId: true,
          productId: true,
          warehouseId: true,
          quantity: true,
          orderId: true,
          order: {
            select: {
              orderNumber: true,
              status: true,
              customer: { select: { firstName: true, lastName: true, email: true } },
            },
          },
        },
      });

      if (activeItems.length > 0) {
        for (const item of activeItems) {
          const matchingRecord = records.find((r) =>
            (r.variantId && r.variantId === item.variantId) ||
            (!r.variantId && r.productId === item.productId)
          );
          if (matchingRecord) {
            blockedInventoryIds.add(matchingRecord.id);
            if (skippedDetails.length < 15) {
              const custName = item.order?.customer
                ? `${item.order.customer.firstName} ${item.order.customer.lastName}`.trim() || item.order.customer.email
                : "Customer";
              const itemLabel = matchingRecord.variant?.title || matchingRecord.variant?.sku || matchingRecord.product?.title || "Item";
              skippedDetails.push(
                `${itemLabel}: Reserved in Order #${item.order?.orderNumber || item.orderId} (${item.order?.status}) by ${custName}`
              );
            }
          }
        }
      }
    }

    const eligibleIds = records
      .map((r) => r.id)
      .filter((id) => !blockedInventoryIds.has(id));

    skippedCount += blockedInventoryIds.size;

    if (eligibleIds.length > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.inventoryAdjustment.deleteMany({
          where: { inventoryId: { in: eligibleIds } },
        });
        const res = await tx.inventory.deleteMany({
          where: { id: { in: eligibleIds } },
        });
        deletedCount += res.count;
      });
    }
  }

  return {
    deletedCount,
    skippedCount,
    skippedDetails,
  };
}
