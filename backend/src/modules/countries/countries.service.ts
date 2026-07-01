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
