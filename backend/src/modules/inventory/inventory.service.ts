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
  sortBy?: string;
  sortDir?: string;
  requestingUserId?: string;
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
  const where: Prisma.InventoryWhereInput = {};
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
  const [summary, lowStockCount, outOfStockCount, recentItems, recentAdjustments] = await Promise.all([
    prisma.inventory.aggregate({
      _count: { id: true },
      _sum: { stock: true, reservedStock: true },
    }),
    prisma.inventory.count({ where: { status: "LOW_STOCK" } }),
    prisma.inventory.count({ where: { status: "OUT_OF_STOCK" } }),
    prisma.inventory.findMany({
      take: 6,
      orderBy: { updatedAt: "desc" },
      include: inventoryInclude(),
    }),
    prisma.inventoryAdjustment.findMany({
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
      lowStockCount,
      outOfStockCount,
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
  const nextReservedStock = data.reservedStock ?? existing.reservedStock;
  const nextLowStockThreshold = data.lowStockThreshold ?? existing.lowStockThreshold;
  if (nextReservedStock > nextStock) throw new AppError("Reserved stock cannot exceed stock.", 400);
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
  const reservedStock = Math.trunc(Number(data.reservedStock ?? 0));
  const lowStockThreshold = Math.trunc(Number(data.lowStockThreshold ?? 10));
  if (![stock, reservedStock, lowStockThreshold].every(Number.isFinite) || stock < 0 || reservedStock < 0 || lowStockThreshold < 0) {
    throw new AppError("Inventory values must be valid non-negative numbers.", 400);
  }
  if (reservedStock > stock) throw new AppError("Reserved stock cannot exceed stock.", 400);

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

  await prisma.$transaction(async (tx) => {
    for (let index = 0; index < uniqueIds.length; index += 1) {
      const id = uniqueIds[index];
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
  });

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
    where: { OR: [{ status: "LOW_STOCK" }, { status: "OUT_OF_STOCK" }] },
    include: { product: { select: { id: true, title: true, sku: true } }, variant: { include: { product: { select: { id: true, title: true } } } } },
    orderBy: [{ updatedAt: "desc" }],
  });
}

function parseInventoryImportRow(row: Record<string, string>) {
  const variantId = row.variantId?.trim() || "";
  const variantSku = row.variantSku?.trim() || "";
  const productSku = row.productSku?.trim() || "";

  return {
    variantId,
    variantSku,
    productSku,
    warehouseId: row.warehouseId?.trim().toUpperCase() || "",
    stock: row.stock?.trim() || "",
    reservedStock: row.reservedStock?.trim() || "",
    lowStockThreshold: row.lowStockThreshold?.trim() || "",
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
  };
}

export async function importInventorySpreadsheet(filePath: string) {
  const rows = readSpreadsheetRows(filePath);
  const preview = await previewInventoryImportRows(rows);
  if (preview.issues.length > 0) {
    throw new AppError(`Import validation failed with ${preview.issues.length} issue(s).`, 400);
  }

  const summary = { created: 0, updated: 0 };

  await prisma.$transaction(async (tx) => {
    for (const [index, row] of preview.rows.entries()) {
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
  });

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

  const inventories = await prisma.inventory.findMany({
    where,
    orderBy: buildInventoryOrder(query),
    include: inventoryInclude(),
  });

  return writeSpreadsheetBuffer(
    inventories.map(buildInventoryExportRow),
    "Inventory",
    INVENTORY_EXPORT_COLUMNS.map((column) => ({ key: column.key, header: column.header })),
  );
}


export async function deleteInventory(id: string) {
  const existing = await prisma.inventory.findUnique({ where: { id } });
  if (!existing) throw new AppError("Inventory record not found.", 404);

  // Safety check removed per user request: allow deletion even if stock exists

  await prisma.inventory.delete({ where: { id } });
}
