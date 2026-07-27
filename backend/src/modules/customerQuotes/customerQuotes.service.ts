import { prisma } from "../../config/database";
import { AppError } from "../../utils/apiResponse";

export async function listCustomerQuotes(customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: {
      id: customerId,
      deletedAt: null,
    },
  });

  if (!customer) {
    throw new AppError("Customer account not found.", 404);
  }

  return prisma.quote.findMany({
    where: {
      OR: [
        { customerId: customer.id },
        { customerEmail: { equals: customer.email, mode: "insensitive" } },
      ],
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      items: {
        include: {
          product: true,
          variant: true,
        },
      },
      country: true,
      currency: true,
    },
  });
}

export async function getCustomerQuote(customerId: string, quoteId: string) {
  const customer = await prisma.customer.findUnique({
    where: {
      id: customerId,
    },
  });

  if (!customer || customer.deletedAt) {
    throw new AppError("Customer account not found.", 404);
  }

  const quote = await prisma.quote.findFirst({
    where: {
      id: quoteId,
      OR: [
        { customerId: customer.id },
        { customerEmail: { equals: customer.email, mode: "insensitive" } },
      ],
    },
    include: {
      items: {
        include: {
          product: true,
          variant: true,
        },
      },
      country: true,
      currency: true,
    },
  });

  if (!quote) {
    throw new AppError("Quote not found.", 404);
  }

  return quote;
}

export async function acceptCustomerQuote(customerId: string, quoteId: string) {
  const quote = await getCustomerQuote(customerId, quoteId);
  if (quote.status === "CONVERTED" || quote.status === "ACCEPTED") {
    throw new AppError("Quote has already been accepted or converted.", 400);
  }
  if (quote.status === "DECLINED" || quote.status === "EXPIRED") {
    throw new AppError("Expired or declined quotes cannot be accepted.", 400);
  }
  return prisma.quote.update({
    where: { id: quote.id },
    data: { status: "ACCEPTED" },
  });
}

export async function declineCustomerQuote(customerId: string, quoteId: string) {
  const quote = await getCustomerQuote(customerId, quoteId);
  if (quote.status === "CONVERTED") {
    throw new AppError("Converted quotes cannot be declined.", 400);
  }
  return prisma.quote.update({
    where: { id: quote.id },
    data: { status: "DECLINED" },
  });
}
