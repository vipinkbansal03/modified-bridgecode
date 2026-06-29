import { prisma } from "../../config/database";
import { AppError } from "../../utils/apiResponse";

export const listCountries = () => prisma.country.findMany({ where: { status: "ACTIVE" }, include: { currency: true }, orderBy: { name: "asc" } });

export const createCountry = async (data: object) => {
  const payload = data as { isDefault?: boolean };
  return prisma.$transaction(async (tx) => {
    if (payload.isDefault) await tx.country.updateMany({ data: { isDefault: false } });
    return tx.country.create({ data: data as never, include: { currency: true } });
  });
};

export const updateCountry = async (id: string, data: object) => {
  const payload = data as { isDefault?: boolean };
  return prisma.$transaction(async (tx) => {
    if (payload.isDefault) await tx.country.updateMany({ where: { id: { not: id } }, data: { isDefault: false } });
    return tx.country.update({ where: { id }, data: data as never, include: { currency: true } });
  });
};

export const deleteCountry = async (id: string) => {
  const country = await prisma.country.findUnique({ where: { id }, select: { isDefault: true } });
  if (country?.isDefault) throw new AppError("Default country cannot be deleted.", 400);
  return prisma.country.update({ where: { id }, data: { status: "INACTIVE" } });
};
