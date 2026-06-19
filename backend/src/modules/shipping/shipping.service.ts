import { prisma } from "../../config/database";
export const listProviders = () => prisma.shippingProvider.findMany({ include: { zones: { include: { country: true } } } });
export const upsertProvider = (data: object) => prisma.shippingProvider.upsert({ where: { name: (data as {name:string}).name }, create: data as never, update: data as never });
export const listZones = () => prisma.shippingZone.findMany({ include: { provider: true, country: true } });
export const createZone = (data: object) => prisma.shippingZone.create({ data: data as never, include: { country: true, provider: true } });
export const updateZone = (id: string, data: object) => prisma.shippingZone.update({ where: { id }, data: data as never });

/**
 * Calculate shipping charge for a given country and order subtotal.
 * Returns the cheapest enabled zone that covers the country, applying
 * free-shipping threshold if the order total qualifies.
 */
export async function calculateShipping(countryCode: string, orderTotal: number): Promise<{
  charge: number;
  isFree: boolean;
  provider: string | null;
  estimatedDays: string | null;
}> {
  const country = await prisma.country.findUnique({ where: { code: countryCode } });
  if (!country) return { charge: 0, isFree: false, provider: null, estimatedDays: null };

  const zones = await prisma.shippingZone.findMany({
    where: { countryId: country.id, status: "ACTIVE", provider: { isEnabled: true } },
    include: { provider: true },
    orderBy: { charge: "asc" },
  });

  if (!zones.length) return { charge: 0, isFree: false, provider: null, estimatedDays: null };

  const zone = zones[0];
  const freeAbove = zone.freeAbove ? Number(zone.freeAbove) : null;
  const isFree = freeAbove !== null && orderTotal >= freeAbove;

  return {
    charge: isFree ? 0 : Number(zone.charge),
    isFree,
    provider: zone.provider.displayName,
    estimatedDays: zone.estimatedDays,
  };
}
