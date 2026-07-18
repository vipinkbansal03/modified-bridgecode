import { prisma } from "../../config/database";
import { AppError } from "../../utils/apiResponse";

export const listCountries = () =>
  prisma.country.findMany({
    include: { currency: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

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
  const payload = data as { isDefault?: boolean; status?: string; code?: string };
  return prisma.$transaction(async (tx) => {
    const current = await tx.country.findUnique({ where: { id }, select: { id: true, isDefault: true } });
    if (!current) throw new AppError("Country not found.", 404);
    if ((payload.isDefault ?? current.isDefault) && payload.status === "INACTIVE") {
      throw new AppError("Default country must remain active.", 400);
    }
    const code = payload.code?.trim().toUpperCase();
    if (code) {
      const duplicate = await tx.country.findFirst({ where: { code, NOT: { id } }, select: { id: true } });
      if (duplicate) throw new AppError("A country with this code already exists.", 409);
    }
    if (payload.isDefault) await tx.country.updateMany({ where: { id: { not: id } }, data: { isDefault: false } });
    return tx.country.update({
      where: { id },
      data: { ...(data as Record<string, unknown>), ...(code ? { code } : {}) } as never,
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
};
