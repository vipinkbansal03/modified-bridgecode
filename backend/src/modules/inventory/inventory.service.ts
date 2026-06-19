import { prisma } from "../../config/database";
import { getPagination } from "../../utils/apiResponse";

export async function listInventory(query: { page?: string; limit?: string; search?: string }) {
  const { page, limit, skip } = getPagination(query);
  const [data, total] = await Promise.all([
    prisma.inventory.findMany({
      skip, take: limit,
      include: { variant: { include: { product: { select: { id: true, title: true, sku: true } } } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.inventory.count(),
  ]);
  return { data, total, page, limit };
}

export async function updateInventory(id: string, data: { stock?: number; reservedStock?: number; lowStockThreshold?: number; status?: string }) {
  return prisma.inventory.update({ where: { id }, data: data as never });
}

export async function getLowStockAlerts() {
  return prisma.inventory.findMany({
    where: { OR: [{ status: "LOW_STOCK" }, { status: "OUT_OF_STOCK" }] },
    include: { variant: { include: { product: { select: { id: true, title: true } } } } },
  });
}
