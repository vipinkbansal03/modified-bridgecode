import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { AppError } from "../../utils/apiResponse";

export type WarehouseResolutionClient = typeof prisma | Prisma.TransactionClient;

export interface ResolveWarehouseInput {
  productId: string;
  variantId?: string | null;
  quantity: number;
  explicitWarehouseId?: string | null; // "wh-123" (concrete) | null (Base) | undefined (auto-resolve)
  destinationState?: string | null;
  destinationCountryCode?: string | null;
  destinationCountryId?: string | null;
}

export interface ResolveWarehouseResult {
  warehouseId: string | null;
  inventoryId: string;
  availableStock: number;
}

/**
 * Resolves the fulfillment warehouse for an item according to the three-state business rule:
 * 1. explicitWarehouseId is string (Concrete ID) -> strict lookup for that exact warehouse, fails if unavailable
 * 2. explicitWarehouseId === null (Explicit Base) -> strict lookup for Base Inventory (warehouseId = null), fails if unavailable
 * 3. explicitWarehouseId === undefined (Auto-resolve) -> runs State Match -> Country Match -> Stock tiebreaker -> Base fallback
 */
export async function resolveItemFulfillmentWarehouse(
  client: WarehouseResolutionClient,
  input: ResolveWarehouseInput,
): Promise<ResolveWarehouseResult> {
  const {
    productId,
    variantId,
    quantity,
    explicitWarehouseId,
    destinationState,
    destinationCountryCode,
    destinationCountryId,
  } = input;

  if (quantity < 1) {
    throw new AppError("Requested quantity must be at least 1.", 400);
  }

  // =========================================================================
  // Case 1: Explicit Concrete Warehouse ID (e.g. "wh-mumbai")
  // =========================================================================
  if (typeof explicitWarehouseId === "string" && explicitWarehouseId.trim().length > 0) {
    const inv = await client.inventory.findFirst({
      where: variantId
        ? { variantId, warehouseId: explicitWarehouseId }
        : { productId, variantId: null, warehouseId: explicitWarehouseId },
      include: { warehouse: true },
    });

    if (!inv || !inv.warehouse || inv.warehouse.status !== "ACTIVE") {
      throw new AppError("Selected warehouse is not available for this item.", 400);
    }

    const availableStock = Math.max(0, inv.stock - inv.reservedStock);
    if (availableStock < quantity) {
      throw new AppError(
        `Insufficient stock in selected warehouse (${inv.warehouse.name}). Only ${availableStock} unit(s) available.`,
        400,
      );
    }

    return {
      warehouseId: inv.warehouseId,
      inventoryId: inv.id,
      availableStock,
    };
  }

  // =========================================================================
  // Case 2: Explicit Base Inventory / Default Seller (explicitWarehouseId === null)
  // =========================================================================
  if (explicitWarehouseId === null) {
    const baseInv = await client.inventory.findFirst({
      where: variantId
        ? { variantId, warehouseId: null }
        : { productId, variantId: null, warehouseId: null },
    });

    if (!baseInv) {
      throw new AppError("Base / Default Seller inventory record not found for this item.", 400);
    }

    const availableStock = Math.max(0, baseInv.stock - baseInv.reservedStock);
    if (availableStock < quantity) {
      throw new AppError(
        `Insufficient stock in Base / Default Seller inventory. Only ${availableStock} unit(s) available.`,
        400,
      );
    }

    return {
      warehouseId: null,
      inventoryId: baseInv.id,
      availableStock,
    };
  }

  // =========================================================================
  // Case 3: Automatic Warehouse Resolution (explicitWarehouseId === undefined)
  // =========================================================================
  const inventories = await client.inventory.findMany({
    where: variantId
      ? { variantId }
      : { productId, variantId: null },
    include: {
      warehouse: {
        include: {
          country: true,
        },
      },
    },
  });

  const physicalInvs = inventories.filter(
    (inv) => inv.warehouseId && inv.warehouse && inv.warehouse.status === "ACTIVE",
  );
  const baseInv = inventories.find((inv) => inv.warehouseId === null);

  const eligiblePhysical: Array<{
    inv: typeof physicalInvs[0];
    availableStock: number;
    isStateMatch: boolean;
    isLocal: boolean;
  }> = [];

  for (const inv of physicalInvs) {
    const availableStock = Math.max(0, inv.stock - inv.reservedStock);
    if (availableStock < quantity) continue; // must have sufficient available stock

    const w = inv.warehouse!;
    let isEligible = false;

    if (!w.deliveryZones || !Array.isArray(w.deliveryZones) || w.deliveryZones.length === 0) {
      isEligible = true; // No delivery zones defined means delivers everywhere
    } else if (destinationCountryId || destinationCountryCode) {
      const zone = (w.deliveryZones as any[]).find((z: any) =>
        destinationCountryId ? z.countryId === destinationCountryId : true,
      );
      if (zone) {
        if (!zone.states || zone.states.length === 0) {
          isEligible = true; // Delivers everywhere in this country
        } else if (destinationState && zone.states.includes(destinationState)) {
          isEligible = true; // Delivers to this specific state
        }
      }
    } else {
      isEligible = true;
    }

    if (isEligible) {
      const isStateMatch = Boolean(
        destinationState &&
          w.state &&
          w.state.trim().toLowerCase() === destinationState.trim().toLowerCase(),
      );
      const isLocal = Boolean(
        destinationCountryCode &&
          w.country?.code &&
          w.country.code.toUpperCase() === destinationCountryCode.toUpperCase(),
      );

      eligiblePhysical.push({
        inv,
        availableStock,
        isStateMatch,
        isLocal,
      });
    }
  }

  // Sort eligible physical warehouses using the established 3-tier hierarchy:
  // 1. isStateMatch (State Match)
  // 2. isLocal (Country Match)
  // 3. Highest availableStock (Tiebreaker)
  eligiblePhysical.sort((a, b) => {
    if (a.isStateMatch && !b.isStateMatch) return -1;
    if (!a.isStateMatch && b.isStateMatch) return 1;

    if (a.isLocal && !b.isLocal) return -1;
    if (!a.isLocal && b.isLocal) return 1;

    return b.availableStock - a.availableStock;
  });

  if (eligiblePhysical.length > 0) {
    const top = eligiblePhysical[0];
    return {
      warehouseId: top.inv.warehouseId,
      inventoryId: top.inv.id,
      availableStock: top.availableStock,
    };
  }

  // Fallback to Base Inventory (warehouseId = null) if physical warehouses cannot fulfill
  if (baseInv) {
    const baseAvailable = Math.max(0, baseInv.stock - baseInv.reservedStock);
    if (baseAvailable >= quantity) {
      return {
        warehouseId: null,
        inventoryId: baseInv.id,
        availableStock: baseAvailable,
      };
    }
  }

  // Neither physical warehouse nor Base Inventory has sufficient stock
  throw new AppError(`Insufficient stock available for the requested quantity (${quantity}).`, 400);
}
