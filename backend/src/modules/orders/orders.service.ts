import { prisma } from "../../config/database";
import { AppError, getPagination } from "../../utils/apiResponse";

export async function getAnalytics() {
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
  twelveMonthsAgo.setDate(1);
  twelveMonthsAgo.setHours(0, 0, 0, 0);

  const [revenueRaw, ordersByCountry, orderTotals] = await Promise.all([
    prisma.$queryRaw<{ month: string; revenue: number; count: number }[]>`
      SELECT
        TO_CHAR(DATE_TRUNC('month', "createdAt"), 'Mon YY') AS month,
        SUM(CAST(total AS FLOAT)) AS revenue,
        COUNT(*) AS count
      FROM orders
      WHERE "createdAt" >= ${twelveMonthsAgo}
        AND "paymentStatus" = 'PAID'
      GROUP BY DATE_TRUNC('month', "createdAt")
      ORDER BY DATE_TRUNC('month', "createdAt") ASC
    `,
    prisma.$queryRaw<{ country: string; count: number }[]>`
      SELECT c.name AS country, COUNT(o.id) AS count
      FROM orders o
      JOIN countries c ON o."countryId" = c.id
      GROUP BY c.name
      ORDER BY count DESC
      LIMIT 8
    `,
    prisma.order.aggregate({ _sum: { total: true }, _count: true }),
  ]);

  return {
    revenueByMonth: revenueRaw.map((r) => ({
      month: r.month,
      revenue: Number(r.revenue),
      orders: Number(r.count),
    })),
    ordersByCountry: ordersByCountry.map((r) => ({
      country: r.country,
      orders: Number(r.count),
    })),
    totals: {
      allTimeRevenue: Number(orderTotals._sum.total ?? 0),
      totalOrders: orderTotals._count,
    },
  };
}

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

export async function shipOrder(id: string, data: { shippingProvider: string; trackingNumber: string }) {
  await getOrder(id);
  return prisma.order.update({
    where: { id },
    data: {
      status: "SHIPPED",
      shippingProvider: data.shippingProvider,
      trackingNumber: data.trackingNumber,
    },
  });
}

export async function deliverOrder(id: string) {
  const order = await getOrder(id);

  // Decrement inventory for each variant in the order
  await Promise.all(
    order.items
      .filter((item) => item.variantId)
      .map((item) =>
        prisma.inventory.updateMany({
          where: { variantId: item.variantId! },
          data: { stock: { decrement: item.quantity } },
        })
      )
  );

  return prisma.order.update({
    where: { id },
    data: { status: "DELIVERED" },
  });
}
