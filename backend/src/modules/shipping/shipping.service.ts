import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { AppError, getPagination } from "../../utils/apiResponse";
import { logger } from "../../config/logger";
import { getAdapter } from "./adapters";

const PROVIDER_SELECT = {
  id: true,
  name: true,
  displayName: true,
  apiKey: true,
  apiSecret: true,
  baseUrl: true,
  trackingUrl: true,
  isEnabled: true,
  config: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { zones: true } },
} satisfies Prisma.ShippingProviderSelect;

type ProviderRow = Prisma.ShippingProviderGetPayload<{ select: typeof PROVIDER_SELECT }>;

function maskCredential(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length <= 8) return "****";
  return value.slice(0, 4) + "****" + value.slice(-4);
}

function sanitizeProvider(provider: ProviderRow) {
  return {
    ...provider,
    apiKey: maskCredential(provider.apiKey),
    apiSecret: maskCredential(provider.apiSecret),
  };
}

// ─── Provider CRUD ──────────────────────────────────────

const DEFAULT_PROVIDERS = [
  { name: "STANDARD_EXPRESS", displayName: "Standard Delivery", isEnabled: true },
  { name: "DHL", displayName: "DHL Express", isEnabled: false, baseUrl: "https://api.dhl.com/mydhlapi", trackingUrl: "https://track.dhl.com/{tracking}" },
  { name: "DTDC", displayName: "DTDC Courier", isEnabled: false, baseUrl: "https://api.dtdc.in", trackingUrl: "https://www.dtdc.in/tracking/{tracking}" },
];

async function ensureDefaultProviders() {
  for (const p of DEFAULT_PROVIDERS) {
    await prisma.shippingProvider.upsert({
      where: { name: p.name },
      update: { displayName: p.displayName },
      create: { ...p, config: {} },
    });
  }
}

export async function listProviders() {
  await ensureDefaultProviders();
  const providers = await prisma.shippingProvider.findMany({
    select: PROVIDER_SELECT,
    orderBy: { createdAt: "asc" },
  });
  return providers.map(sanitizeProvider);
}

export async function getProvider(id: string) {
  const provider = await prisma.shippingProvider.findUnique({
    where: { id },
    select: { ...PROVIDER_SELECT, zones: { include: { countries: { include: { country: true } } }, orderBy: { charge: "asc" } } },
  });
  if (!provider) throw new AppError("Shipping provider not found.", 404);
  return {
    ...provider,
    apiKey: maskCredential(provider.apiKey),
    apiSecret: maskCredential(provider.apiSecret),
  };
}

export async function upsertProvider(input: {
  name: string;
  displayName?: string;
  apiKey?: string;
  apiSecret?: string;
  baseUrl?: string;
  trackingUrl?: string;
  isEnabled?: boolean;
  config?: Record<string, unknown>;
}) {
  const name = input.name?.trim();
  if (!name) throw new AppError("Provider name is required.", 400);

  const displayName = input.displayName?.trim() || name;
  const normalizedName = name.toUpperCase().replace(/\s+/g, "_");

  const existing = await prisma.shippingProvider.findUnique({ where: { name: normalizedName } });

  const data: Prisma.ShippingProviderUncheckedCreateInput | Prisma.ShippingProviderUncheckedUpdateInput = {
    displayName,
    apiKey: input.apiKey?.trim() || null,
    apiSecret: input.apiSecret?.trim() || null,
    baseUrl: input.baseUrl?.trim() || null,
    trackingUrl: input.trackingUrl?.trim() || null,
    isEnabled: input.isEnabled ?? existing?.isEnabled ?? false,
    config: (input.config ?? existing?.config ?? {}) as Prisma.InputJsonValue,
  };

  if (existing) {
    const updated = await prisma.shippingProvider.update({
      where: { id: existing.id },
      data,
      select: PROVIDER_SELECT,
    });
    return sanitizeProvider(updated);
  }

  const created = await prisma.shippingProvider.create({
    data: { name: normalizedName, ...data } as Prisma.ShippingProviderUncheckedCreateInput,
    select: PROVIDER_SELECT,
  });
  return sanitizeProvider(created);
}

export async function toggleProvider(id: string) {
  const provider = await prisma.shippingProvider.findUnique({ where: { id }, select: { id: true, isEnabled: true, displayName: true } });
  if (!provider) throw new AppError("Shipping provider not found.", 404);

  const updated = await prisma.shippingProvider.update({
    where: { id },
    data: { isEnabled: !provider.isEnabled },
    select: PROVIDER_SELECT,
  });
  logger.info(`Shipping provider "${provider.displayName}" ${updated.isEnabled ? "enabled" : "disabled"}`);
  return sanitizeProvider(updated);
}

// ─── Connection Test ────────────────────────────────────

export async function testConnection(id: string, override?: { apiKey?: string; apiSecret?: string; baseUrl?: string; mode?: string }) {
  const provider = await prisma.shippingProvider.findUnique({
    where: { id },
    select: { id: true, name: true, apiKey: true, apiSecret: true, baseUrl: true, displayName: true, config: true },
  });
  if (!provider) throw new AppError("Shipping provider not found.", 404);

  const apiKey = override?.apiKey ?? provider.apiKey;
  const apiSecret = override?.apiSecret ?? provider.apiSecret;
  const baseUrl = override?.baseUrl ?? provider.baseUrl;
  const providerConfig = (provider.config ?? {}) as Record<string, unknown>;
  const mode = (override?.mode as "sandbox" | "production" | undefined) ?? (providerConfig.mode as "sandbox" | "production") ?? "production";

  if (!apiKey) {
    return { success: false, message: `${provider.displayName} API key is not configured.`, latencyMs: 0 };
  }

  const adapter = getAdapter(provider.name);
  if (!adapter) {
    return { success: false, message: `No adapter available for ${provider.displayName}.`, latencyMs: 0 };
  }

  return adapter.testConnection({ apiKey, apiSecret, baseUrl, mode });
}

// ─── Zone CRUD ──────────────────────────────────────────

export async function listZones(query?: { providerId?: string; countryId?: string; status?: string }) {
  const where: Prisma.ShippingZoneWhereInput = {};
  if (query?.providerId) where.providerId = query.providerId;
  if (query?.countryId) where.countries = { some: { countryId: query.countryId } };
  if (query?.status) where.status = query.status as "ACTIVE" | "INACTIVE";

  return prisma.shippingZone.findMany({
    where,
    include: { provider: true, countries: { include: { country: true } } },
    orderBy: { charge: "asc" },
  });
}

export async function createZone(input: {
  providerId: string;
  countryIds?: string[];
  countryId?: string;
  charge: number | string;
  freeAbove?: number | string | null;
  estimatedDays?: string | null;
  status?: string;
}) {
  if (!input.providerId) throw new AppError("Provider is required.", 400);

  const countryIds = [...new Set(input.countryIds ?? (input.countryId ? [input.countryId] : []))];
  if (countryIds.length === 0) throw new AppError("At least one country is required.", 400);

  const charge = Number(input.charge);
  if (!Number.isFinite(charge) || charge < 0) throw new AppError("Charge must be a non-negative number.", 400);

  const provider = await prisma.shippingProvider.findUnique({ where: { id: input.providerId }, select: { id: true } });
  if (!provider) throw new AppError("Shipping provider not found.", 404);

  const foundCountries = await prisma.country.findMany({ where: { id: { in: countryIds } }, select: { id: true } });
  if (foundCountries.length !== countryIds.length) throw new AppError("One or more countries were not found.", 404);

  const duplicate = await prisma.shippingZone.findFirst({
    where: { providerId: input.providerId, countries: { some: { countryId: { in: countryIds } } } },
    select: { id: true },
  });
  if (duplicate) throw new AppError("A shipping zone already exists for this provider and one of the selected countries.", 409);

  const freeAbove = input.freeAbove != null && input.freeAbove !== "" ? Number(input.freeAbove) : null;
  if (freeAbove !== null && (!Number.isFinite(freeAbove) || freeAbove < 0)) throw new AppError("Free above must be a non-negative number.", 400);

  return prisma.shippingZone.create({
    data: {
      providerId: input.providerId,
      charge,
      freeAbove,
      estimatedDays: input.estimatedDays?.trim() || null,
      status: (input.status as "ACTIVE" | "INACTIVE") || "ACTIVE",
      countries: { create: countryIds.map((countryId) => ({ countryId })) },
    },
    include: { provider: true, countries: { include: { country: true } } },
  });
}

export async function updateZone(id: string, input: {
  providerId?: string;
  countryIds?: string[];
  charge?: number | string;
  freeAbove?: number | string | null;
  estimatedDays?: string | null;
  status?: string;
}) {
  const existing = await prisma.shippingZone.findUnique({ where: { id }, select: { id: true, providerId: true } });
  if (!existing) throw new AppError("Shipping zone not found.", 404);

  if (input.charge !== undefined) {
    const charge = Number(input.charge);
    if (!Number.isFinite(charge) || charge < 0) throw new AppError("Charge must be a non-negative number.", 400);
  }

  if (input.freeAbove !== undefined && input.freeAbove !== null && input.freeAbove !== "") {
    const freeAbove = Number(input.freeAbove);
    if (!Number.isFinite(freeAbove) || freeAbove < 0) throw new AppError("Free above must be a non-negative number.", 400);
  }

  const data: Prisma.ShippingZoneUncheckedUpdateInput = {};
  if (input.providerId) data.providerId = input.providerId;
  if (input.charge !== undefined) data.charge = Number(input.charge);
  if (input.freeAbove !== undefined) data.freeAbove = input.freeAbove != null && input.freeAbove !== "" ? Number(input.freeAbove) : null;
  if (input.estimatedDays !== undefined) data.estimatedDays = input.estimatedDays?.trim() || null;
  if (input.status) data.status = input.status as "ACTIVE" | "INACTIVE";

  let nextCountryIds: string[] | null = null;
  if (input.countryIds) {
    nextCountryIds = [...new Set(input.countryIds)];
    if (nextCountryIds.length === 0) throw new AppError("At least one country is required.", 400);
    const foundCountries = await prisma.country.findMany({ where: { id: { in: nextCountryIds } }, select: { id: true } });
    if (foundCountries.length !== nextCountryIds.length) throw new AppError("One or more countries were not found.", 404);
    data.countries = {
      deleteMany: {},
      create: nextCountryIds.map((countryId) => ({ countryId })),
    };
  }

  if (input.providerId && nextCountryIds) {
    const duplicate = await prisma.shippingZone.findFirst({
      where: { providerId: input.providerId, countries: { some: { countryId: { in: nextCountryIds } } }, NOT: { id } },
      select: { id: true },
    });
    if (duplicate) throw new AppError("A shipping zone already exists for this provider and one of the selected countries.", 409);
  }

  return prisma.shippingZone.update({
    where: { id },
    data,
    include: { provider: true, countries: { include: { country: true } } },
  });
}

export async function deleteZone(id: string) {
  const existing = await prisma.shippingZone.findUnique({
    where: { id },
    select: { id: true, _count: { select: { orders: true } } },
  });
  if (!existing) throw new AppError("Shipping zone not found.", 404);

  if (existing._count.orders > 0) {
    throw new AppError(`Cannot delete: this zone is linked to ${existing._count.orders} order(s). Set status to Inactive instead.`, 400);
  }

  return prisma.shippingZone.delete({ where: { id } });
}

// ─── Shipping Calculation ───────────────────────────────

/**
 * Get all available (active, enabled) shipping options for a country.
 * Used by checkout to let customers choose a provider.
 */
export async function getAvailableProviders(countryCode: string, orderTotal: number): Promise<{
  provider: string;
  providerId: string;
  zoneId: string;
  charge: number;
  isFree: boolean;
  estimatedDays: string | null;
}[]> {
  const country = await prisma.country.findUnique({ where: { code: countryCode } });
  if (!country) return [];

  const zones = await prisma.shippingZone.findMany({
    where: { countries: { some: { countryId: country.id } }, status: "ACTIVE", provider: { isEnabled: true } },
    include: { provider: true },
    orderBy: { charge: "asc" },
  });

  return zones.map((zone) => {
    const freeAbove = zone.freeAbove ? Number(zone.freeAbove) : null;
    const isFree = freeAbove !== null && orderTotal >= freeAbove;
    return {
      provider: zone.provider.displayName,
      providerId: zone.providerId,
      zoneId: zone.id,
      charge: isFree ? 0 : Number(zone.charge),
      isFree,
      estimatedDays: zone.estimatedDays,
    };
  });
}

/**
 * Calculate shipping charge for a given country and order subtotal.
 * Returns the cheapest enabled zone that covers the country, applying
 * free-shipping threshold if the order total qualifies.
 */
export async function calculateShipping(countryCode: string, orderTotal: number): Promise<{
  available: boolean;
  charge: number;
  isFree: boolean;
  provider: string | null;
  providerId: string | null;
  zoneId: string | null;
  estimatedDays: string | null;
  message?: string;
}> {
  const country = await prisma.country.findUnique({ where: { code: countryCode } });
  if (!country) {
    return {
      available: false,
      charge: 0,
      isFree: false,
      provider: null,
      providerId: null,
      zoneId: null,
      estimatedDays: null,
      message: "Selected shipping country is not available.",
    };
  }

  const zones = await prisma.shippingZone.findMany({
    where: { countries: { some: { countryId: country.id } }, status: "ACTIVE", provider: { isEnabled: true } },
    include: { provider: true },
    orderBy: { charge: "asc" },
  });

  if (!zones.length) {
    return {
      available: false,
      charge: 0,
      isFree: false,
      provider: null,
      providerId: null,
      zoneId: null,
      estimatedDays: null,
      message: "Shipping is not available to your country yet. Please contact support.",
    };
  }

  const zone = zones[0];
  const freeAbove = zone.freeAbove ? Number(zone.freeAbove) : null;
  const isFree = freeAbove !== null && orderTotal >= freeAbove;

  return {
    available: true,
    charge: isFree ? 0 : Number(zone.charge),
    isFree,
    provider: zone.provider.displayName,
    providerId: zone.providerId,
    zoneId: zone.id,
    estimatedDays: zone.estimatedDays,
  };
}

export async function calculateRequiredShipping(countryCode: string, orderTotal: number, zoneId?: string) {
  if (zoneId) {
    const zone = await prisma.shippingZone.findUnique({
      where: { id: zoneId },
      include: { provider: true },
    });
    if (!zone) throw new AppError("Shipping zone not found.", 404);
    if (!zone.provider.isEnabled) throw new AppError("Selected shipping provider is not available.", 400);

    const freeAbove = zone.freeAbove ? Number(zone.freeAbove) : null;
    const isFree = freeAbove !== null && orderTotal >= freeAbove;

    return {
      available: true,
      charge: isFree ? 0 : Number(zone.charge),
      isFree,
      provider: zone.provider.displayName,
      providerId: zone.providerId,
      zoneId: zone.id,
      estimatedDays: zone.estimatedDays,
    };
  }
  const shipping = await calculateShipping(countryCode, orderTotal);
  if (!shipping.available || !shipping.zoneId) {
    throw new AppError(shipping.message ?? "Shipping is not available to your country yet. Please contact support.", 400);
  }
  return shipping;
}

// ─── Shipments ──────────────────────────────────────────

const SHIPMENT_SELECT = {
  id: true,
  orderId: true,
  providerId: true,
  status: true,
  trackingNumber: true,
  awbNumber: true,
  labelUrl: true,
  estimatedDelivery: true,
  shippingCharge: true,
  notes: true,
  providerResponse: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ShipmentSelect;

export async function listShipments(query?: { orderId?: string; status?: string; providerId?: string; page?: string; limit?: string }) {
  const where: Prisma.ShipmentWhereInput = {};
  if (query?.orderId) where.orderId = query.orderId;
  if (query?.status) where.status = query.status as never;
  if (query?.providerId) where.providerId = query.providerId;

  const { page, limit, skip } = getPagination({ page: query?.page, limit: query?.limit });
  const [data, total] = await Promise.all([
    prisma.shipment.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: { ...SHIPMENT_SELECT, order: { select: { id: true, orderNumber: true, customerName: true } }, provider: { select: { id: true, name: true, displayName: true } } },
    }),
    prisma.shipment.count({ where }),
  ]);
  return { data, total, page, limit };
}

export async function getShipment(id: string) {
  const shipment = await prisma.shipment.findUnique({
    where: { id },
    select: {
      ...SHIPMENT_SELECT,
      order: { select: { id: true, orderNumber: true, customerName: true, customerEmail: true, shippingAddress: true, country: { select: { code: true, name: true } } } },
      provider: { select: { id: true, name: true, displayName: true, trackingUrl: true } },
      events: { orderBy: { timestamp: "desc" } },
    },
  });
  if (!shipment) throw new AppError("Shipment not found.", 404);
  return shipment;
}

export async function getShipmentsForOrder(orderId: string) {
  return prisma.shipment.findMany({
    where: { orderId },
    orderBy: { createdAt: "desc" },
    select: {
      ...SHIPMENT_SELECT,
      provider: { select: { id: true, name: true, displayName: true } },
      events: { orderBy: { timestamp: "desc" }, take: 1 },
    },
  });
}

export async function createShipment(input: {
  orderId: string;
  providerId: string;
  trackingNumber?: string;
  awbNumber?: string;
  shippingCharge?: number | string;
  estimatedDelivery?: string;
  notes?: string;
  callProvider?: boolean;
}) {
  if (!input.orderId) throw new AppError("Order ID is required.", 400);
  if (!input.providerId) throw new AppError("Provider ID is required.", 400);

  const order = await prisma.order.findUnique({ where: { id: input.orderId }, select: { id: true, orderNumber: true, customerName: true, customerEmail: true, shippingAddress: true, country: { select: { id: true, code: true } }, items: { select: { title: true, sku: true, quantity: true, total: true, variant: { select: { weight: true } } } } } });
  if (!order) throw new AppError("Order not found.", 404);

  const provider = await prisma.shippingProvider.findUnique({ where: { id: input.providerId }, select: { id: true, name: true, apiKey: true, apiSecret: true, baseUrl: true } });
  if (!provider) throw new AppError("Shipping provider not found.", 404);

  const shippingCharge = input.shippingCharge != null ? Number(input.shippingCharge) : null;

  let trackingNumber = input.trackingNumber?.trim() || null;
  let awbNumber = input.awbNumber?.trim() || null;
  let labelUrl: string | null = null;
  let estimatedDelivery = input.estimatedDelivery?.trim() || null;
  let providerResponse: Record<string, unknown> | null = null;

  // Call provider API if requested and adapter is available
  if (input.callProvider && provider.apiKey) {
    const adapter = getAdapter(provider.name);
    if (adapter) {
      const shipAddr = (order.shippingAddress as Record<string, string>) ?? {};
      const adapterResult = await adapter.createShipment(
        { apiKey: provider.apiKey, apiSecret: provider.apiSecret, baseUrl: provider.baseUrl },
        {
          orderNumber: order.orderNumber,
          recipientName: order.customerName,
          recipientEmail: order.customerEmail ?? undefined,
          address: shipAddr,
          countryCode: order.country?.code ?? "IN",
          items: order.items.map((item) => ({
            title: item.title,
            sku: item.sku ?? undefined,
            quantity: item.quantity,
            weight: item.variant?.weight != null ? Number(item.variant.weight) : undefined,
            value: Number(item.total),
          })),
          totalValue: Number(order.items.reduce((sum, item) => sum + Number(item.total), 0)),
          reference: order.orderNumber,
        },
      );

      if (adapterResult.success) {
        trackingNumber = adapterResult.trackingNumber ?? trackingNumber;
        awbNumber = adapterResult.trackingNumber ?? awbNumber;
        labelUrl = adapterResult.labelUrl ?? null;
        estimatedDelivery = adapterResult.estimatedDelivery ?? estimatedDelivery;
        providerResponse = adapterResult.providerResponse as Record<string, unknown> ?? null;
      } else {
        logger.warn(`Provider API call failed for ${provider.name}: ${adapterResult.error}`);
      }
    }
  }

  const shipment = await prisma.shipment.create({
    data: {
      orderId: input.orderId,
      providerId: input.providerId,
      status: trackingNumber ? "LABEL_GENERATED" : "CREATED",
      trackingNumber,
      awbNumber,
      labelUrl,
      estimatedDelivery,
      shippingCharge,
      notes: input.notes?.trim() || null,
      providerResponse: providerResponse as Prisma.InputJsonValue | undefined,
    },
    select: SHIPMENT_SELECT,
  });

  await prisma.shipmentEvent.create({
    data: {
      shipmentId: shipment.id,
      status: trackingNumber ? "LABEL_GENERATED" : "CREATED",
      description: `Shipment created with ${provider.name}${trackingNumber ? ` (AWB: ${trackingNumber})` : ""}.`,
    },
  });

  logger.info(`Shipment ${shipment.id} created for order ${order.orderNumber}`);
  return shipment;
}

export async function updateShipment(id: string, input: {
  trackingNumber?: string;
  awbNumber?: string;
  estimatedDelivery?: string;
  shippingCharge?: number | string;
  notes?: string;
}) {
  const existing = await prisma.shipment.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new AppError("Shipment not found.", 404);

  const data: Prisma.ShipmentUncheckedUpdateInput = {};
  if (input.trackingNumber !== undefined) data.trackingNumber = input.trackingNumber?.trim() || null;
  if (input.awbNumber !== undefined) data.awbNumber = input.awbNumber?.trim() || null;
  if (input.estimatedDelivery !== undefined) data.estimatedDelivery = input.estimatedDelivery?.trim() || null;
  if (input.shippingCharge !== undefined) data.shippingCharge = input.shippingCharge != null ? Number(input.shippingCharge) : null;
  if (input.notes !== undefined) data.notes = input.notes?.trim() || null;

  return prisma.shipment.update({ where: { id }, data, select: SHIPMENT_SELECT });
}

export async function updateShipmentStatus(id: string, input: { status: string; location?: string; description?: string }) {
  const shipment = await prisma.shipment.findUnique({ where: { id }, select: { id: true, orderId: true, status: true } });
  if (!shipment) throw new AppError("Shipment not found.", 404);

  const newStatus = input.status as never;
  const updated = await prisma.shipment.update({ where: { id }, data: { status: newStatus }, select: SHIPMENT_SELECT });

  await prisma.shipmentEvent.create({
    data: {
      shipmentId: id,
      status: newStatus,
      location: input.location?.trim() || null,
      description: input.description?.trim() || null,
    },
  });

  if (newStatus === "DELIVERED") {
    await prisma.order.update({ where: { id: shipment.orderId }, data: { status: "DELIVERED" } });
  }

  logger.info(`Shipment ${id} status updated to ${newStatus}`);
  return updated;
}

export async function addShipmentEvent(shipmentId: string, input: { status: string; location?: string; description?: string }) {
  const shipment = await prisma.shipment.findUnique({ where: { id: shipmentId }, select: { id: true } });
  if (!shipment) throw new AppError("Shipment not found.", 404);

  return prisma.shipmentEvent.create({
    data: {
      shipmentId,
      status: input.status as never,
      location: input.location?.trim() || null,
      description: input.description?.trim() || null,
    },
  });
}

export async function trackShipmentFromProvider(id: string) {
  const shipment = await prisma.shipment.findUnique({
    where: { id },
    select: { id: true, trackingNumber: true, provider: { select: { name: true, apiKey: true, apiSecret: true, baseUrl: true } } },
  });
  if (!shipment) throw new AppError("Shipment not found.", 404);
  if (!shipment.trackingNumber) throw new AppError("This shipment has no tracking number.", 400);

  const adapter = getAdapter(shipment.provider.name);
  if (!adapter) throw new AppError(`No adapter available for ${shipment.provider.name}.`, 400);

  const result = await adapter.trackShipment(
    { apiKey: shipment.provider.apiKey ?? "", apiSecret: shipment.provider.apiSecret, baseUrl: shipment.provider.baseUrl },
    shipment.trackingNumber,
  );

  if (result.updates?.length) {
    const latest = result.updates[0];
    await prisma.shipment.update({ where: { id }, data: { status: result.status as never } });
    await prisma.shipmentEvent.createMany({
      data: result.updates.map((u) => ({
        shipmentId: id,
        status: u.status as never,
        location: u.location ?? null,
        description: u.description ?? null,
        timestamp: new Date(u.timestamp),
        raw: u as unknown as Prisma.InputJsonValue,
      })),
      skipDuplicates: true,
    });
  }

  return result;
}

export async function cancelShipmentFromProvider(id: string) {
  const shipment = await prisma.shipment.findUnique({
    where: { id },
    select: { id: true, status: true, trackingNumber: true, provider: { select: { name: true, apiKey: true, apiSecret: true, baseUrl: true } } },
  });
  if (!shipment) throw new AppError("Shipment not found.", 404);
  if (shipment.status === "CANCELLED") throw new AppError("Shipment is already cancelled.", 400);
  if (shipment.status === "DELIVERED") throw new AppError("Cannot cancel a delivered shipment.", 400);
  if (!shipment.trackingNumber) throw new AppError("This shipment has no tracking number to cancel.", 400);

  const adapter = getAdapter(shipment.provider.name);
  if (!adapter?.cancelShipment) throw new AppError(`${shipment.provider.name} does not support shipment cancellation.`, 400);

  const result = await adapter.cancelShipment(
    { apiKey: shipment.provider.apiKey ?? "", apiSecret: shipment.provider.apiSecret, baseUrl: shipment.provider.baseUrl },
    shipment.trackingNumber,
  );

  if (result.success) {
    await prisma.shipment.update({ where: { id }, data: { status: "CANCELLED" } });
    await prisma.shipmentEvent.create({
      data: {
        shipmentId: id,
        status: "CANCELLED",
        description: result.message,
        raw: result.raw as Prisma.InputJsonValue | undefined,
      },
    });
    logger.info(`Shipment ${id} cancelled via ${shipment.provider.name}`);
  }

  return result;
}

export async function deleteShipment(id: string) {
  const shipment = await prisma.shipment.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!shipment) throw new AppError("Shipment not found.", 404);
  if (shipment.status !== "CREATED" && shipment.status !== "CANCELLED") {
    throw new AppError("Only shipments in CREATED or CANCELLED status can be deleted.", 400);
  }
  await prisma.shipmentEvent.deleteMany({ where: { shipmentId: id } });
  return prisma.shipment.delete({ where: { id } });
}
