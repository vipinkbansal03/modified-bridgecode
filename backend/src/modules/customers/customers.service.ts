import { ApprovalStatus, CustomerType, Status } from "@prisma/client";
import { prisma } from "../../config/database";
import { AppError, getPagination } from "../../utils/apiResponse";
import { sendCustomerApprovalEmail, sendCustomerRejectionEmail } from "../../utils/email";
import { assignCustomerRole } from "../customerRoles/customerRoles.service";
import { assertTierUsable } from "../tiers/tiers.service";

type CustomerProfileInput = {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string | null;
  status?: Status;
  customerType?: CustomerType;
  approvalStatus?: ApprovalStatus;
};

type CustomerListQuery = {
  page?: string;
  limit?: string;
  search?: string;
  status?: Status;
  customerType?: CustomerType;
  approvalStatus?: ApprovalStatus;
  customerRoleId?: string | null;
  tierId?: string | null;
  countryId?: string | null;
  sortBy?: string;
  sortDir?: string;
};

export async function listCustomers(query: CustomerListQuery) {
  const { page, limit, skip } = getPagination(query);
  const where = {
    deletedAt: null,
    ...(query.status && { status: query.status }),
    ...(query.customerType && { customerType: query.customerType }),
    ...(query.approvalStatus && { approvalStatus: query.approvalStatus }),
    ...(query.customerRoleId && { customerRoleId: query.customerRoleId }),
    ...(query.tierId && { tierId: query.tierId }),
    ...(query.countryId && { defaultCountryId: query.countryId }),
    ...(query.search && {
      OR: [
        { email: { contains: query.search, mode: "insensitive" as const } },
        { firstName: { contains: query.search, mode: "insensitive" as const } },
        { lastName: { contains: query.search, mode: "insensitive" as const } },
        { companyName: { contains: query.search, mode: "insensitive" as const } },
        { phone: { contains: query.search, mode: "insensitive" as const } },
      ],
    }),
  };

  const sortDir = query.sortDir === "asc" ? "asc" : "desc";
  const orderBy = (() => {
    switch (query.sortBy) {
      case "email":
        return [{ email: sortDir }, { createdAt: "desc" }];
      case "status":
        return [{ status: sortDir }, { createdAt: "desc" }];
      case "approvalStatus":
        return [{ approvalStatus: sortDir }, { createdAt: "desc" }];
      case "customerType":
        return [{ customerType: sortDir }, { createdAt: "desc" }];
      case "updatedAt":
        return [{ updatedAt: sortDir }, { createdAt: "desc" }];
      case "firstName":
      case "lastName":
      case "name":
      default:
        return [{ firstName: sortDir }, { lastName: sortDir }, { createdAt: "desc" }];
    }
  })();

  const [data, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      skip,
      take: limit,
      orderBy: orderBy as never,
      include: { tier: true, customerRole: true, defaultCountry: true },
    }),
    prisma.customer.count({ where }),
  ]);

  return { data, total, page, limit };
}

export async function getCustomer(id: string) {
  const customer = await prisma.customer.findUnique({
    where: { id, deletedAt: null },
    include: { tier: true, defaultCountry: true, customerRole: true },
  });
  if (!customer) throw new AppError("Customer not found.", 404);
  return customer;
}

export async function updateCustomerTier(id: string, tierId: string | null) {
  await getCustomer(id);
  if (tierId) {
    await assertTierUsable(tierId);
  }
  return prisma.customer.update({
    where: { id },
    data: { tierId },
    include: { tier: true, customerRole: true, defaultCountry: true },
  });
}

export async function updateCustomerRole(id: string, customerRoleId: string) {
  return assignCustomerRole(id, customerRoleId);
}

export async function updateCustomerProfile(id: string, data: CustomerProfileInput) {
  await getCustomer(id);

  const next: CustomerProfileInput = {};
  if (data.firstName !== undefined) {
    const firstName = data.firstName.trim();
    if (!firstName) throw new AppError("First name is required.", 400);
    next.firstName = firstName;
  }
  if (data.lastName !== undefined) {
    const lastName = data.lastName.trim();
    if (!lastName) throw new AppError("Last name is required.", 400);
    next.lastName = lastName;
  }
  if (data.email !== undefined) {
    const email = data.email.trim().toLowerCase();
    if (!email) throw new AppError("Email is required.", 400);
    const existing = await prisma.customer.findFirst({
      where: { email, deletedAt: null, NOT: { id } },
      select: { id: true },
    });
    if (existing) throw new AppError("A customer with this email already exists.", 409);
    next.email = email;
  }
  if (data.phone !== undefined) next.phone = data.phone?.trim() || null;
  if (data.status !== undefined) {
    if (!Object.values(Status).includes(data.status)) throw new AppError("Invalid customer status.", 400);
    next.status = data.status;
  }
  if (data.customerType !== undefined) {
    if (!Object.values(CustomerType).includes(data.customerType)) throw new AppError("Invalid customer type.", 400);
    next.customerType = data.customerType;
    if (data.customerType === "WHOLESALE" && data.approvalStatus === undefined) next.approvalStatus = "PENDING_APPROVAL";
  }
  if (data.approvalStatus !== undefined) {
    if (!Object.values(ApprovalStatus).includes(data.approvalStatus)) throw new AppError("Invalid approval status.", 400);
    next.approvalStatus = data.approvalStatus;
  }

  return prisma.customer.update({
    where: { id },
    data: next,
    include: { tier: true, defaultCountry: true, customerRole: true },
  });
}

export async function approveCustomer(id: string) {
  const customer = await prisma.customer.update({
    where: { id },
    data: { approvalStatus: "ACTIVE" },
    include: { tier: true, defaultCountry: true, customerRole: true },
  });
  await sendCustomerApprovalEmail({ email: customer.email, firstName: customer.firstName });
  return customer;
}

export async function rejectCustomer(id: string) {
  const customer = await prisma.customer.update({
    where: { id },
    data: { approvalStatus: "SUSPENDED" },
    include: { tier: true, defaultCountry: true, customerRole: true },
  });
  await sendCustomerRejectionEmail({ email: customer.email, firstName: customer.firstName });
  return customer;
}

export async function listCustomerOrders(id: string) {
  await getCustomer(id);
  return prisma.order.findMany({
    where: { customerId: id },
    orderBy: { createdAt: "desc" },
    include: {
      items: { include: { product: true, variant: true } },
      country: true,
      currency: true,
    },
  });
}

export async function listCustomerAddresses(id: string) {
  await getCustomer(id);
  return prisma.customerAddress.findMany({
    where: { customerId: id },
    include: { country: true },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
}
