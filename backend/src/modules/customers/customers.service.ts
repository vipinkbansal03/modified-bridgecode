import bcrypt from "bcryptjs";
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
  taxId?: string | null;
  taxIdType?: string | null;
  taxIdStatus?: string;
  taxExemptCertificateUrl?: string | null;
  customerRoleId?: string | null;
  tierId?: string | null;
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
  deleted?: boolean | string;
};

export async function listCustomers(query: CustomerListQuery) {
  const { page, limit, skip } = getPagination(query);
  const isDeleted = query.deleted === true || query.deleted === "true";
  const where = {
    deletedAt: isDeleted ? { not: null } : null,
    ...(query.status && { status: query.status }),
    ...(query.customerType && { customerType: query.customerType }),
    ...(query.approvalStatus && { approvalStatus: query.approvalStatus }),
    ...(query.customerRoleId && { customerRoleId: query.customerRoleId }),
    ...(query.countryId
      ? (() => {
          const ids = query.countryId.split(",").map((s) => s.trim()).filter(Boolean);
          return ids.length > 1 ? { defaultCountryId: { in: ids } } : { defaultCountryId: ids[0] };
        })()
      : {}),
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
    if (query.sortBy === "deletedAt") {
      return [{ deletedAt: sortDir }, { createdAt: "desc" }];
    }
    if (isDeleted && !query.sortBy) {
      return [{ deletedAt: "desc" }, { createdAt: "desc" }];
    }
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
      case "createdAt":
        return [{ createdAt: sortDir }];
      case "firstName":
      case "lastName":
      case "name":
      default:
        return isDeleted
          ? [{ deletedAt: "desc" }, { createdAt: "desc" }]
          : [{ firstName: sortDir }, { lastName: sortDir }, { createdAt: "desc" }];
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
  if (data.taxId !== undefined) next.taxId = data.taxId;
  if (data.taxIdType !== undefined) next.taxIdType = data.taxIdType;
  if (data.taxIdStatus !== undefined) next.taxIdStatus = data.taxIdStatus;
  if (data.taxExemptCertificateUrl !== undefined) next.taxExemptCertificateUrl = data.taxExemptCertificateUrl;

  if (data.customerRoleId !== undefined) {
    if (data.customerRoleId) {
      const role = await prisma.customerRole.findUnique({ where: { id: data.customerRoleId } });
      if (!role) throw new AppError("Customer role not found.", 404);
      if (role.status !== "ACTIVE") throw new AppError("Only active customer roles can be assigned.", 400);
      next.customerRoleId = data.customerRoleId;
    } else {
      next.customerRoleId = null;
    }
  }

  if (data.tierId !== undefined) {
    if (data.tierId) {
      await assertTierUsable(data.tierId);
      next.tierId = data.tierId;
    } else {
      next.tierId = null;
    }
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

export const deleteCustomer = async (id: string) => {
  const customer = await prisma.customer.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      status: "INACTIVE",
      refreshToken: null,
    },
  });

  await prisma.deviceToken.deleteMany({ where: { customerId: id } }).catch(() => {});

  return customer;
};

export async function restoreCustomer(id: string) {
  const customer = await prisma.customer.findUnique({
    where: { id },
  });
  if (!customer) throw new AppError("Customer not found.", 404);
  if (!customer.deletedAt) throw new AppError("Customer is already active.", 400);

  // Email uniqueness collision check against active customers
  const activeConflict = await prisma.customer.findFirst({
    where: {
      email: { equals: customer.email, mode: "insensitive" },
      deletedAt: null,
      id: { not: id },
    },
  });
  if (activeConflict) {
    throw new AppError(
      `Cannot restore customer: email "${customer.email}" is already registered to another active customer account.`,
      409,
    );
  }

  const restored = await prisma.customer.update({
    where: { id },
    data: {
      deletedAt: null,
      status: "ACTIVE",
    },
    include: { tier: true, customerRole: true, defaultCountry: true },
  });

  return restored;
}

export async function updateCustomerAddress(customerId: string, addressId: string, data: any) {
  const addr = await prisma.customerAddress.findFirst({
    where: { id: addressId, customerId },
  });
  if (!addr) throw new AppError("Address not found.", 404);

  return prisma.customerAddress.update({
    where: { id: addressId },
    data: {
      fullName: data.fullName?.trim(),
      phone: data.phone?.trim() || null,
      addressLine1: data.addressLine1?.trim(),
      addressLine2: data.addressLine2?.trim() || null,
      city: data.city?.trim(),
      state: data.state?.trim() || null,
      postalCode: data.postalCode?.trim(),
      countryId: data.countryId,
    },
    include: { country: true },
  });
}

export async function createCustomer(data: {
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  phone?: string | null;
  companyName?: string | null;
  customerType?: CustomerType;
  status?: Status;
  approvalStatus?: ApprovalStatus;
  customerRoleId?: string | null;
  tierId?: string | null;
  defaultCountryId?: string | null;
  taxId?: string | null;
  taxIdType?: string | null;
}) {
  if (!data.email?.trim()) throw new AppError("Email is required.", 400);
  if (!data.firstName?.trim()) throw new AppError("First name is required.", 400);
  if (!data.lastName?.trim()) throw new AppError("Last name is required.", 400);

  const email = data.email.trim().toLowerCase();
  const existing = await prisma.customer.findFirst({
    where: { email, deletedAt: null },
  });
  if (existing) {
    throw new AppError("A customer with this email already exists.", 409);
  }

  const rawPassword = data.password?.trim() || Math.random().toString(36).slice(-8) + "Aa1!";
  const passwordHash = await bcrypt.hash(rawPassword, 10);

  if (data.tierId) {
    await assertTierUsable(data.tierId);
  }

  const customer = await prisma.customer.create({
    data: {
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      email,
      passwordHash,
      phone: data.phone?.trim() || null,
      companyName: data.companyName?.trim() || null,
      customerType: data.customerType || CustomerType.RETAIL,
      status: data.status || Status.ACTIVE,
      approvalStatus: data.approvalStatus || ApprovalStatus.ACTIVE,
      customerRoleId: data.customerRoleId || null,
      tierId: data.tierId || null,
      defaultCountryId: data.defaultCountryId || null,
      taxId: data.taxId?.trim() || null,
      taxIdType: data.taxIdType?.trim() || null,
    },
    include: { tier: true, customerRole: true, defaultCountry: true },
  });

  return customer;
}

