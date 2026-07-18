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
      customerId: customer.id,
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

  if (!customer) {
    throw new AppError("Customer account not found.", 404);
  }

  const quote = await prisma.quote.findFirst({
    where: {
      id: quoteId,
      customerId: customer.id,
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
