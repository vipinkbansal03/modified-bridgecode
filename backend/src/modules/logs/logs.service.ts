import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { getPagination } from "../../utils/apiResponse";

export async function listLogs(query: { page?: string; limit?: string; entityType?: string; action?: string }) {
  const { page, limit, skip } = getPagination(query);
  const where: Prisma.ActivityLogWhereInput = {
    ...(query.entityType ? { entityType: query.entityType } : {}),
    ...(query.action ? { action: { contains: query.action, mode: "insensitive" } } : {}),
  };

  const [data, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      skip,
      take: limit,
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.activityLog.count({ where }),
  ]);

  return { data, total, page, limit };
}
