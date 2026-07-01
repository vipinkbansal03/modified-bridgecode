import { prisma } from "../../config/database";
import { AppError } from "../../utils/apiResponse";

export async function assertTierUsable(tierId: string, options?: { countryId?: string | null }) {
  const tier = await prisma.tier.findUnique({
    where: { id: tierId },
    include: {
      countries: {
        select: {
          countryId: true,
          enabled: true,
        },
      },
    },
  });
  if (!tier) throw new AppError("Tier not found.", 404);
  if (tier.status !== "ACTIVE") throw new AppError("Only active tiers can be assigned or used in pricing.", 400);

  if (options?.countryId) {
    const hasMappings = tier.countries.length > 0;
    const allowedForCountry = !hasMappings || tier.countries.some((mapping) => mapping.countryId === options.countryId && mapping.enabled);
    if (!allowedForCountry) {
      throw new AppError("This tier is not enabled for the selected country.", 400);
    }
  }

  return tier;
}

export function listTiers() {
  return prisma.tier.findMany({
    include: { _count: { select: { customers: true, pricing: true, discounts: true } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function createTier(data: { name?: string; status?: string; sortOrder?: number | string }) {
  const name = data.name?.trim();
  if (!name) throw new AppError("Tier name is required.", 400);
  const existing = await prisma.tier.findUnique({ where: { name } });
  if (existing) throw new AppError("A tier with this name already exists.", 409);

  return prisma.tier.create({
    data: {
      name,
      status: (data.status as never) || "ACTIVE",
      sortOrder: Number(data.sortOrder ?? 0),
    },
    include: { _count: { select: { customers: true, pricing: true, discounts: true } } },
  });
}

export async function updateTier(id: string, data: { name?: string; status?: string; sortOrder?: number | string }) {
  const tier = await prisma.tier.findUnique({ where: { id } });
  if (!tier) throw new AppError("Tier not found.", 404);

  const name = data.name?.trim();
  if (name) {
    const duplicate = await prisma.tier.findFirst({ where: { name, id: { not: id } } });
    if (duplicate) throw new AppError("A tier with this name already exists.", 409);
  }

  return prisma.tier.update({
    where: { id },
    data: {
      ...(name ? { name } : {}),
      ...(data.status ? { status: data.status as never } : {}),
      ...(data.sortOrder !== undefined ? { sortOrder: Number(data.sortOrder) } : {}),
    },
    include: { _count: { select: { customers: true, pricing: true, discounts: true } } },
  });
}

export async function deleteTier(id: string) {
  const tier = await prisma.tier.findUnique({
    where: { id },
    include: { _count: { select: { customers: true, pricing: true, discounts: true } } },
  });
  if (!tier) throw new AppError("Tier not found.", 404);

  if (tier._count.customers > 0) {
    throw new AppError(`Cannot delete tier: ${tier._count.customers} customer${tier._count.customers === 1 ? " is" : "s are"} assigned to it.`, 400);
  }
  if (tier._count.pricing > 0) {
    throw new AppError(`Cannot delete tier: ${tier._count.pricing} tier pricing rule${tier._count.pricing === 1 ? " references" : "s reference"} it.`, 400);
  }
  if (tier._count.discounts > 0) {
    throw new AppError(`Cannot delete tier: ${tier._count.discounts} discount${tier._count.discounts === 1 ? " references" : "s reference"} it.`, 400);
  }

  await prisma.tier.delete({ where: { id } });
}

export async function reorderTiers(items: { id: string; sortOrder: number }[]) {
  if (!Array.isArray(items)) throw new AppError("Reorder payload must include an array of items.", 400);
  const ids = [...new Set(items.map((item) => item.id))];
  const tiers = await prisma.tier.findMany({ where: { id: { in: ids } }, select: { id: true } });
  if (tiers.length !== ids.length) throw new AppError("One or more tiers were not found.", 400);

  await prisma.$transaction(
    items.map((item) =>
      prisma.tier.update({
        where: { id: item.id },
        data: { sortOrder: Number(item.sortOrder) },
      }),
    ),
  );
  return listTiers();
}

export async function listTierCountries(tierId: string) {
  const tier = await prisma.tier.findUnique({ where: { id: tierId }, select: { id: true } });
  if (!tier) throw new AppError("Tier not found.", 404);

  const [countries, mappings] = await Promise.all([
    prisma.country.findMany({ include: { currency: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.tierCountry.findMany({ where: { tierId } }),
  ]);
  const mappingByCountry = new Map(mappings.map((mapping) => [mapping.countryId, mapping]));
  return countries.map((country) => {
    const mapping = mappingByCountry.get(country.id);
    return {
      ...country,
      tierCountryId: mapping?.id ?? null,
      enabled: mapping?.enabled ?? false,
    };
  });
}

export async function updateTierCountries(tierId: string, items: { countryId: string; enabled: boolean }[]) {
  const tier = await prisma.tier.findUnique({ where: { id: tierId }, select: { id: true } });
  if (!tier) throw new AppError("Tier not found.", 404);
  if (!Array.isArray(items)) throw new AppError("Country mapping payload must include an array of items.", 400);

  const countryIds = [...new Set(items.map((item) => item.countryId))];
  const countries = await prisma.country.findMany({ where: { id: { in: countryIds } }, select: { id: true } });
  if (countries.length !== countryIds.length) throw new AppError("One or more countries were not found.", 400);

  await prisma.$transaction(
    items.map((item) =>
      prisma.tierCountry.upsert({
        where: { tierId_countryId: { tierId, countryId: item.countryId } },
        update: { enabled: Boolean(item.enabled) },
        create: { tierId, countryId: item.countryId, enabled: Boolean(item.enabled) },
      }),
    ),
  );
  return listTierCountries(tierId);
}
