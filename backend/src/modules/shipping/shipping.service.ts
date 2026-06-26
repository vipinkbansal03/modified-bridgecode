import { prisma } from "../../config/database";
import { AppError } from "../../utils/apiResponse";
export const listProviders = () => prisma.shippingProvider.findMany({ include: { zones: { include: { country: true } } } });
export const upsertProvider = (data: object) => prisma.shippingProvider.upsert({ where: { name: (data as {name:string}).name }, create: data as never, update: data as never });
export const listZones = () => prisma.shippingZone.findMany({ include: { provider: true, country: true } });
export const createZone = (data: object) => prisma.shippingZone.create({ data: data as never, include: { country: true, provider: true } });
export const updateZone = (id: string, data: object) => prisma.shippingZone.update({ where: { id }, data: data as never, include: { country: true, provider: true } });
export const deleteZone = (id: string) => prisma.shippingZone.delete({ where: { id } });

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
    where: { countryId: country.id, status: "ACTIVE", provider: { isEnabled: true } },
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

export async function calculateRequiredShipping(countryCode: string, orderTotal: number) {
  const shipping = await calculateShipping(countryCode, orderTotal);
  if (!shipping.available || !shipping.zoneId) {
    throw new AppError(shipping.message ?? "Shipping is not available to your country yet. Please contact support.", 400);
  }
  return shipping;
}
