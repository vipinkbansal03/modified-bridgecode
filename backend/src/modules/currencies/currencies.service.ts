import { prisma } from "../../config/database";
export const listCurrencies = () => prisma.currency.findMany({ orderBy: { code: "asc" } });
export const createCurrency = (data: object) => prisma.currency.create({ data: data as never });
export const updateCurrency = (id: string, data: object) => prisma.currency.update({ where: { id }, data: data as never });
// In production, sync rates from an external provider e.g. OpenExchangeRates
export async function syncExchangeRates() {
  return { message: "Connect to OpenExchangeRates or similar API here." };
}
