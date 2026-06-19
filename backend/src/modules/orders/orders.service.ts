import { prisma } from "../../config/database";
import { AppError, getPagination } from "../../utils/apiResponse";

export async function listOrders(query: { page?: string; limit?: string; status?: string; paymentStatus?: string }) {
  const { page, limit, skip } = getPagination(query);
  const where: Record<string, unknown> = {};
  if (query.status) where.status = query.status;
  if (query.paymentStatus) where.paymentStatus = query.paymentStatus;
  const [data, total] = await Promise.all([
    prisma.order.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" }, include: { country: true, currency: true, _count: { select: { items: true } } } }),
    prisma.order.count({ where }),
  ]);
  return { data, total, page, limit };
}

export async function getOrder(id: string) {
  const o = await prisma.order.findUnique({ where: { id }, include: { items: { include: { product: true, variant: true } }, country: true, currency: true, coupon: true } });
  if (!o) throw new AppError("Order not found.", 404);
  return o;
}

export const updateStatus = (id: string, status: string) => prisma.order.update({ where: { id }, data: { status: status as never } });
export const updatePaymentStatus = (id: string, paymentStatus: string) => prisma.order.update({ where: { id }, data: { paymentStatus: paymentStatus as never } });
export const updateShipping = (id: string, data: { shippingProvider?: string; trackingNumber?: string }) =>
  prisma.order.update({ where: { id }, data });
