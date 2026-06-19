import { prisma } from "../../config/database";
export const listProviders = () => prisma.shippingProvider.findMany({ include: { zones: { include: { country: true } } } });
export const upsertProvider = (data: object) => prisma.shippingProvider.upsert({ where: { name: (data as {name:string}).name }, create: data as never, update: data as never });
export const listZones = () => prisma.shippingZone.findMany({ include: { provider: true, country: true } });
export const createZone = (data: object) => prisma.shippingZone.create({ data: data as never, include: { country: true, provider: true } });
export const updateZone = (id: string, data: object) => prisma.shippingZone.update({ where: { id }, data: data as never });
