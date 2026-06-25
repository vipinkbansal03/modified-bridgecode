import { prisma } from "../../config/database";
import { AppError, getPagination } from "../../utils/apiResponse";

export async function listCustomers(query: { page?: string; limit?: string; search?: string }) {
  const { page, limit, skip } = getPagination(query);
  const where = query.search
    ? {
        OR: [
          { email: { contains: query.search, mode: "insensitive" as const } },
          { firstName: { contains: query.search, mode: "insensitive" as const } },
          { lastName: { contains: query.search, mode: "insensitive" as const } },
        ],
        deletedAt: null,
      }
    : { deletedAt: null };

  const [data, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { tier: true },
    }),
    prisma.customer.count({ where }),
  ]);

  return { data, total, page, limit };
}

export async function getCustomer(id: string) {
  const customer = await prisma.customer.findUnique({
    where: { id, deletedAt: null },
    include: { tier: true, defaultCountry: true },
  });
  if (!customer) throw new AppError("Customer not found.", 404);
  return customer;
}

export async function updateCustomerTier(id: string, tierId: string | null) {
  await getCustomer(id);
  if (tierId) {
    const tier = await prisma.tier.findUnique({ where: { id: tierId } });
    if (!tier) throw new AppError("Tier not found.", 404);
  }
  return prisma.customer.update({
    where: { id },
    data: { tierId },
    include: { tier: true },
  });
}
