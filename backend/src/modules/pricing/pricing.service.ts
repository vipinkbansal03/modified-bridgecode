import { prisma } from "../../config/database";
import { convertPrice } from "../../utils/apiResponse";

export const listPricing = (productId?: string) =>
  prisma.productPrice.findMany({
    where: productId ? { productId } : {},
    include: { product: { select: { title: true } }, variant: { select: { title: true } }, country: true, currency: true },
    orderBy: { createdAt: "desc" },
  });

export const createPrice = (data: object) => prisma.productPrice.create({ data: data as never });
export const updatePrice = (id: string, data: object) => prisma.productPrice.update({ where: { id }, data: data as never });

export async function generateCountryPrices(productId: string, basePrice: number, baseCurrencyId: string) {
  const countries = await prisma.country.findMany({ where: { status: "ACTIVE" }, include: { currency: true } });
  const baseCurrency = await prisma.currency.findUnique({ where: { id: baseCurrencyId } });
  if (!baseCurrency) throw new Error("Base currency not found.");

  const prices = countries.map((country) => ({
    productId,
    countryId: country.id,
    currencyId: country.currencyId,
    mrp: convertPrice(basePrice, Number(country.currency.exchangeRate) / Number(baseCurrency.exchangeRate)),
    sellingPrice: convertPrice(basePrice * 0.9, Number(country.currency.exchangeRate) / Number(baseCurrency.exchangeRate)),
    status: "ACTIVE" as const,
  }));

  for (const p of prices) {
    await prisma.productPrice.upsert({
      where: { productId_variantId_countryId: { productId: p.productId, variantId: null as unknown as string, countryId: p.countryId } },
      update: p,
      create: p,
    });
  }
  return prices.length;
}
