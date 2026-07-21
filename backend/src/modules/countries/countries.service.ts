import { prisma } from "../../config/database";
import { AppError } from "../../utils/apiResponse";
import { WORLD_COUNTRIES } from "../../utils/worldCountriesData";
import { WORLD_CURRENCIES } from "../../utils/worldCurrenciesData";

let isWorldCountriesSeeded = false;

export async function ensureAllWorldCountriesSeeded() {
  if (isWorldCountriesSeeded) return;

  // 1. Ensure all official world currencies exist in database
  const existingCurrenciesList = await prisma.currency.findMany();
  const existingCurrencyCodes = new Set(existingCurrenciesList.map((c) => c.code.toUpperCase()));

  const missingCurrencies = WORLD_CURRENCIES.filter((item) => !existingCurrencyCodes.has(item.code.toUpperCase()));

  if (missingCurrencies.length > 0) {
    for (const curr of missingCurrencies) {
      await prisma.currency.upsert({
        where: { code: curr.code.toUpperCase() },
        update: { symbol: curr.symbol, name: curr.name },
        create: {
          code: curr.code.toUpperCase(),
          name: curr.name,
          symbol: curr.symbol,
          exchangeRate: 1.0,
          isBase: curr.code.toUpperCase() === "USD",
        },
      });
    }
  }

  // 2. Fetch updated currencies map
  const allCurrencies = await prisma.currency.findMany();
  const currencyMap = new Map(allCurrencies.map((c) => [c.code.toUpperCase(), c.id]));
  const defaultCurrencyId = currencyMap.get("USD") || allCurrencies[0]?.id;

  if (!defaultCurrencyId) return;

  // 3. Fetch existing countries and seed/update mappings
  const existingCountries = await prisma.country.findMany({ select: { id: true, code: true, currencyId: true } });
  const existingCountryMap = new Map(existingCountries.map((c) => [c.code.toUpperCase(), c]));

  const recordsToCreate = [];

  for (const item of WORLD_COUNTRIES) {
    const code = item.code.toUpperCase();
    const matchedCurrencyId = currencyMap.get(item.currencyCode.toUpperCase()) || defaultCurrencyId;
    const existing = existingCountryMap.get(code);

    if (!existing) {
      recordsToCreate.push({
        name: item.name,
        code,
        currencyId: matchedCurrencyId,
        status: "INACTIVE" as const,
        isDefault: false,
        dutyPercentage: 0,
        shippingCharge: 0,
      });
    } else if (existing.currencyId !== matchedCurrencyId) {
      // Update existing country to its real official currency
      await prisma.country.update({
        where: { id: existing.id },
        data: { currencyId: matchedCurrencyId },
      });
    }
  }

  if (recordsToCreate.length > 0) {
    await prisma.country.createMany({
      data: recordsToCreate,
      skipDuplicates: true,
    });
  }

  isWorldCountriesSeeded = true;
}

export const listCountries = async (query?: { status?: string }) => {
  await ensureAllWorldCountriesSeeded();
  const where: Record<string, unknown> = {};
  if (query?.status) {
    where.status = query.status.toUpperCase();
  }
  return prisma.country.findMany({
    where,
    include: { currency: true },
    orderBy: [{ isDefault: "desc" }, { status: "asc" }, { name: "asc" }],
  });
};

export const createCountry = async (data: object) => {
  const payload = data as { isDefault?: boolean; status?: string; code?: string };
  if (payload.isDefault && payload.status === "INACTIVE") {
    throw new AppError("Default country must be active.", 400);
  }
  const code = String(payload.code ?? "").trim().toUpperCase();
  if (!code) throw new AppError("Country code is required.", 400);
  return prisma.$transaction(async (tx) => {
    const duplicate = await tx.country.findFirst({ where: { code }, select: { id: true } });
    if (duplicate) throw new AppError("A country with this code already exists.", 409);
    if (payload.isDefault) await tx.country.updateMany({ data: { isDefault: false } });
    return tx.country.create({ data: { ...(data as Record<string, unknown>), code } as never, include: { currency: true } });
  });
};

export const updateCountry = async (id: string, data: object) => {
  const payload = data as {
    isDefault?: boolean;
    status?: "ACTIVE" | "INACTIVE";
    currencyId?: string;
    dutyPercentage?: number | string;
    shippingCharge?: number | string;
  };

  return prisma.$transaction(async (tx) => {
    const current = await tx.country.findUnique({ where: { id }, select: { id: true, isDefault: true } });
    if (!current) throw new AppError("Country not found.", 404);

    if ((payload.isDefault ?? current.isDefault) && payload.status === "INACTIVE") {
      throw new AppError("Default country must remain active.", 400);
    }

    if (payload.isDefault) {
      await tx.country.updateMany({ where: { id: { not: id } }, data: { isDefault: false } });
    }

    const updateData: Record<string, unknown> = {};
    if (payload.currencyId !== undefined) updateData.currencyId = payload.currencyId;
    if (payload.status !== undefined) updateData.status = payload.status;
    if (payload.isDefault !== undefined) updateData.isDefault = payload.isDefault;
    if (payload.dutyPercentage !== undefined) updateData.dutyPercentage = payload.dutyPercentage;
    if (payload.shippingCharge !== undefined) updateData.shippingCharge = payload.shippingCharge;

    return tx.country.update({
      where: { id },
      data: updateData as never,
      include: { currency: true },
    });
  });
};

export const deleteCountry = async (id: string) => {
  const country = await prisma.country.findUnique({ where: { id }, select: { isDefault: true } });
  if (country?.isDefault) throw new AppError("Default country cannot be deleted.", 400);
  return prisma.country.update({ where: { id }, data: { status: "INACTIVE" } });
};

export async function bulkUpdateCountries(input: { ids: string[]; action: "ENABLE" | "DISABLE" | "DELETE" }) {
  const ids = Array.isArray(input.ids) ? Array.from(new Set(input.ids.map((id) => id.trim()).filter(Boolean))) : [];
  if (!ids.length) throw new AppError("Select at least one country.", 400);

  const action = String(input.action ?? "").toUpperCase();
  if (!["ENABLE", "DISABLE", "DELETE"].includes(action)) throw new AppError("Invalid bulk action.", 400);

  const existing = await prisma.country.findMany({ where: { id: { in: ids } }, select: { id: true, isDefault: true } });
  if (existing.length !== ids.length) throw new AppError("One or more countries were not found.", 404);

  const defaultIds = existing.filter((c) => c.isDefault).map((c) => c.id);
  if (defaultIds.length > 0 && action === "DELETE") {
    throw new AppError("Default country cannot be deleted.", 400);
  }

  if (action === "DELETE") {
    const results = [];
    for (const id of ids) {
      try {
        await deleteCountry(id);
        results.push({ id, success: true });
      } catch (error) {
        results.push({ id, success: false, error: error instanceof Error ? error.message : "Failed to delete country." });
      }
    }
    return { action, results, summary: { total: ids.length, succeeded: results.filter((r) => r.success).length, failed: results.filter((r) => !r.success).length } };
  }

  const status = action === "ENABLE" ? "ACTIVE" : "INACTIVE";
  await prisma.country.updateMany({ where: { id: { in: ids } }, data: { status } });
  return { action, affected: ids.length, status };
}
