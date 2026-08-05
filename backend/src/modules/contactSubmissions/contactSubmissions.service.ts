import { Request } from "express";
import { prisma } from "../../config/database";
import { Prisma } from "@prisma/client";
import { AppError, getPagination } from "../../utils/apiResponse";

export const listContactSubmissions = async (query: Request["query"]) => {
  const { page, limit, skip } = getPagination({
    page: query.page as string,
    limit: query.limit as string,
  });

  const search = String(query.search ?? "").trim();
  const sortBy = String(query.sortBy ?? "createdAt");
  const sortDir = query.sortDir === "asc" ? "asc" : "desc";

  const allowedSortFields = ["createdAt", "name", "email", "company"] as const;

  const orderByField = allowedSortFields.includes(
    sortBy as (typeof allowedSortFields)[number],
  )
    ? sortBy
    : "createdAt";

  const type = query.type ? String(query.type).trim() : undefined;

  const where: Prisma.ContactSubmissionWhereInput = {
    ...(type
      ? type === "general"
        ? {
            OR: [
              { type: "general" },
              { type: null },
            ],
          }
        : { type }
      : {}),
    ...(search
      ? {
          OR: [
            {
              name: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
            {
              email: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
            {
              company: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
            {
              phone: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
            {
              subject: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
            {
              message: {
                contains: search,
                mode: "insensitive" as const,
              },
            },
          ],
        }
      : {}),
  };

  const [submissions, total] = await Promise.all([
    prisma.contactSubmission.findMany({
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
    prisma.contactSubmission.count({
      where,
    }),
  ]);

  return {
    data: submissions,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

export const getContactSubmission = async (id: string) => {
  const submission = await prisma.contactSubmission.findUnique({
    where: { id },
  });

  if (!submission) {
    throw new AppError("Contact submission not found.", 404);
  }

  return submission;
};
