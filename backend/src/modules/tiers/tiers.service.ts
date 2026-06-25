import { prisma } from "../../config/database";

export function listTiers() {
  return prisma.tier.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
}
