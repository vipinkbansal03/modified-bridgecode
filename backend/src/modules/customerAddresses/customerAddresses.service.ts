import { prisma } from "../../config/database";

export async function listCustomerAddresses(customerId: string) {
  return prisma.customerAddress.findMany({
    where: { customerId },
    include: { country: true },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
}
