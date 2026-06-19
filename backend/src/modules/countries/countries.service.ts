import { prisma } from "../../config/database";
export const listCountries = () => prisma.country.findMany({ where: { status: "ACTIVE" }, include: { currency: true }, orderBy: { name: "asc" } });
export const createCountry = (data: object) => prisma.country.create({ data: data as never, include: { currency: true } });
export const updateCountry = (id: string, data: object) => prisma.country.update({ where: { id }, data: data as never });
