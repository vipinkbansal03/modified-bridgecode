import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { getPagination } from "../../utils/apiResponse";

export function getClientIp(req: any): string {
  if (!req) return "127.0.0.1";
  const forwarded = req.headers?.["x-forwarded-for"];
  if (forwarded) {
    const first = typeof forwarded === "string" ? forwarded.split(",")[0].trim() : forwarded[0];
    if (first && first !== "::1" && first !== "127.0.0.1") return first;
  }
  const realIp = req.headers?.["x-real-ip"];
  if (realIp && typeof realIp === "string" && realIp !== "::1" && realIp !== "127.0.0.1") return realIp.trim();
  if (req.ip && req.ip !== "::1") return req.ip;
  if (req.socket?.remoteAddress && req.socket.remoteAddress !== "::1") return req.socket.remoteAddress;
  return "127.0.0.1";
}

export async function logActivity(params: {
  userId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: unknown;
  req?: any;
  ipAddress?: string | null;
  userAgent?: string | null;
}) {
  try {
    const ip = params.ipAddress || (params.req ? getClientIp(params.req) : "127.0.0.1");
    const userAgent = params.userAgent || (params.req ? params.req.headers?.["user-agent"] : undefined);
    return await prisma.activityLog.create({
      data: {
        userId: params.userId ?? (params.req?.user?.id ?? null),
        action: params.action,
        entityType: params.entityType ?? null,
        entityId: params.entityId ?? null,
        metadata: (params.metadata as Prisma.InputJsonValue) ?? undefined,
        ipAddress: ip,
        userAgent: typeof userAgent === "string" ? userAgent.slice(0, 500) : undefined,
      },
    });
  } catch (error) {
    console.error("Failed to write activity log:", error);
    return null;
  }
}

export async function listLogs(query: {
  page?: string;
  limit?: string;
  entityType?: string;
  action?: string;
  search?: string;
  category?: string;
  mainOnly?: string;
}) {
  const { page, limit, skip } = getPagination(query);
  const where: Prisma.ActivityLogWhereInput = {};

  if (query.entityType) {
    where.entityType = { equals: query.entityType, mode: "insensitive" };
  } else if (query.category) {
    switch (query.category.toUpperCase()) {
      case "PRODUCTS":
        where.entityType = { in: ["Product", "ProductVariant", "Category", "Brand"], mode: "insensitive" };
        break;
      case "ORDERS":
        where.entityType = { in: ["Order", "Shipment", "Invoice", "Return"], mode: "insensitive" };
        break;
      case "QUOTES":
        where.entityType = { in: ["Quote"], mode: "insensitive" };
        break;
      case "CUSTOMERS":
        where.entityType = { in: ["Customer", "User", "Role"], mode: "insensitive" };
        break;
      case "PRICING":
        where.entityType = { in: ["Pricing", "Currency", "Discount", "Coupon"], mode: "insensitive" };
        break;
      case "MAIN":
      default:
        where.entityType = { in: ["Product", "Order", "Quote", "Customer", "User", "Discount", "Inventory", "Currency"], mode: "insensitive" };
        break;
    }
  } else if (query.mainOnly === "true" || query.mainOnly === "1") {
    where.entityType = { in: ["Product", "Order", "Quote", "Customer", "User", "Discount", "Inventory", "Currency"], mode: "insensitive" };
  }

  if (query.action) {
    where.action = { contains: query.action, mode: "insensitive" };
  }

  if (query.search?.trim()) {
    const s = query.search.trim();
    where.OR = [
      { action: { contains: s, mode: "insensitive" } },
      { entityType: { contains: s, mode: "insensitive" } },
      { entityId: { contains: s, mode: "insensitive" } },
      { ipAddress: { contains: s, mode: "insensitive" } },
      { user: { name: { contains: s, mode: "insensitive" } } },
      { user: { email: { contains: s, mode: "insensitive" } } },
    ];
  }

  const [rawLogs, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      skip,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.activityLog.count({ where }),
  ]);

  const data = rawLogs.map((log) => ({
    ...log,
    ipAddress: log.ipAddress || "127.0.0.1",
  }));

  return { data, total, page, limit };
}
