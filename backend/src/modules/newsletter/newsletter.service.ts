import { Request } from "express";
import { prisma } from "../../config/database";
import { Prisma } from "@prisma/client";
import { AppError, getPagination } from "../../utils/apiResponse";

export const subscribe = async (email: string, source: string = "FOOTER") => {
  const normalizedEmail = email.toLowerCase().trim();
  if (!normalizedEmail) {
    throw new AppError("Email is required.", 400);
  }

  const existing = await prisma.newsletterSubscriber.findUnique({
    where: { email: normalizedEmail },
  });

  if (existing) {
    if (existing.status === "ACTIVE") {
      return { subscriber: existing, alreadyActive: true };
    }
    // Reactivate unsubscribed subscriber
    const updated = await prisma.newsletterSubscriber.update({
      where: { id: existing.id },
      data: {
        status: "ACTIVE",
        source,
        subscribedAt: new Date(),
        unsubscribedAt: null,
      },
    });
    return { subscriber: updated, alreadyActive: false };
  }

  const created = await prisma.newsletterSubscriber.create({
    data: {
      email: normalizedEmail,
      status: "ACTIVE",
      source,
      subscribedAt: new Date(),
    },
  });

  return { subscriber: created, alreadyActive: false };
};

export const unsubscribe = async (email: string) => {
  const normalizedEmail = email.toLowerCase().trim();
  if (!normalizedEmail) {
    throw new AppError("Email is required.", 400);
  }

  const existing = await prisma.newsletterSubscriber.findUnique({
    where: { email: normalizedEmail },
  });

  if (!existing) {
    throw new AppError("Subscriber not found.", 404);
  }

  if (existing.status === "UNSUBSCRIBED") {
    return { subscriber: existing, alreadyUnsubscribed: true };
  }

  const updated = await prisma.newsletterSubscriber.update({
    where: { id: existing.id },
    data: {
      status: "UNSUBSCRIBED",
      unsubscribedAt: new Date(),
    },
  });

  return { subscriber: updated, alreadyUnsubscribed: false };
};

export const listSubscribers = async (query: Request["query"]) => {
  const { page, limit, skip } = getPagination({
    page: query.page as string,
    limit: query.limit as string,
  });

  const search = String(query.search ?? "").trim();
  const status = String(query.status ?? "").trim();
  const sortBy = String(query.sortBy ?? "subscribedAt");
  const sortDir = query.sortDir === "asc" ? "asc" : "desc";

  const allowedSortFields = ["subscribedAt", "unsubscribedAt", "email", "status", "createdAt"] as const;
  const orderByField = allowedSortFields.includes(
    sortBy as (typeof allowedSortFields)[number]
  )
    ? sortBy
    : "subscribedAt";

  const where: Prisma.NewsletterSubscriberWhereInput = {
    AND: [
      search ? {
        email: {
          contains: search,
          mode: "insensitive" as const,
        },
      } : {},
      status ? {
        status,
      } : {},
    ],
  };

  const [subscribers, total] = await Promise.all([
    prisma.newsletterSubscriber.findMany({
      where,
      skip,
      take: limit,
      orderBy: [
        {
          [orderByField]: sortDir,
        },
        {
          createdAt: "desc",
        },
      ],
    }),
    prisma.newsletterSubscriber.count({
      where,
    }),
  ]);

  return {
    data: subscribers,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const createManual = async (email: string) => {
  const normalizedEmail = email.toLowerCase().trim();
  if (!normalizedEmail) {
    throw new AppError("Email is required.", 400);
  }

  const existing = await prisma.newsletterSubscriber.findUnique({
    where: { email: normalizedEmail },
  });

  if (existing) {
    if (existing.status === "ACTIVE") {
      throw new AppError("This email is already an active subscriber.", 400);
    }
    // Update to active
    return await prisma.newsletterSubscriber.update({
      where: { id: existing.id },
      data: {
        status: "ACTIVE",
        source: "ADMIN",
        subscribedAt: new Date(),
        unsubscribedAt: null,
      },
    });
  }

  return await prisma.newsletterSubscriber.create({
    data: {
      email: normalizedEmail,
      status: "ACTIVE",
      source: "ADMIN",
      subscribedAt: new Date(),
    },
  });
};

export const updateStatus = async (id: string, status: string) => {
  if (status !== "ACTIVE" && status !== "UNSUBSCRIBED") {
    throw new AppError("Invalid subscriber status.", 400);
  }

  const existing = await prisma.newsletterSubscriber.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new AppError("Subscriber not found.", 404);
  }

  return await prisma.newsletterSubscriber.update({
    where: { id },
    data: {
      status,
      subscribedAt: status === "ACTIVE" ? new Date() : existing.subscribedAt,
      unsubscribedAt: status === "UNSUBSCRIBED" ? new Date() : null,
    },
  });
};
