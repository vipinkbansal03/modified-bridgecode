import { Prisma, Status } from "@prisma/client";
import { prisma } from "../../config/database";
import { AppError } from "../../utils/apiResponse";

export const SYSTEM_CUSTOMER_ROLE_KEYS = {
  guest: "GUEST",
  dealer: "DEALER",
  doctorRetailer: "DOCTOR_RETAILER",
} as const;

type CustomerRoleKey = (typeof SYSTEM_CUSTOMER_ROLE_KEYS)[keyof typeof SYSTEM_CUSTOMER_ROLE_KEYS];

type CustomerRoleInput = {
  key?: string;
  name?: string;
  description?: string | null;
  status?: Status;
  sortOrder?: number | string;
};

function normalizeRoleKey(value?: string) {
  return value
    ?.trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
}

function cleanOptional(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function isSystemRoleKey(value: string) {
  return Object.values(SYSTEM_CUSTOMER_ROLE_KEYS).includes(value as CustomerRoleKey);
}

export async function listCustomerRoles() {
  return prisma.customerRole.findMany({
    include: { _count: { select: { customers: true } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function getCustomerRoleByKey(key: string) {
  return prisma.customerRole.findUnique({ where: { key } });
}

export async function ensureCustomerRoleByKey(key: string) {
  let role = await getCustomerRoleByKey(key);
  if (!role) {
    const defaultRoleNames: Record<string, string> = {
      GUEST: "Guest Customer",
      DEALER: "Dealer / B2B Wholesale",
      DOCTOR_RETAILER: "Doctor / Retailer",
    };
    role = await prisma.customerRole.upsert({
      where: { key },
      create: {
        key,
        name: defaultRoleNames[key] ?? key,
        description: `System customer role for ${key}`,
        status: "ACTIVE",
        sortOrder: key === "GUEST" ? 1 : key === "DOCTOR_RETAILER" ? 2 : 3,
      },
      update: {},
    });
  }
  if (role.status !== "ACTIVE") throw new AppError(`Customer role ${role.name} is inactive.`, 400);
  return role;
}

export function mapLegacyCustomerTypeToRoleKey(customerType?: string | null): CustomerRoleKey {
  if (customerType === "DEALER" || customerType === "WHOLESALE") return SYSTEM_CUSTOMER_ROLE_KEYS.dealer;
  return SYSTEM_CUSTOMER_ROLE_KEYS.doctorRetailer;
}

export async function resolveCustomerRoleFromCustomer(customerId?: string | null) {
  if (!customerId) {
    return ensureCustomerRoleByKey(SYSTEM_CUSTOMER_ROLE_KEYS.guest);
  }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId, deletedAt: null },
    select: {
      customerType: true,
      customerRole: true,
    },
  });

  if (!customer) {
    return ensureCustomerRoleByKey(SYSTEM_CUSTOMER_ROLE_KEYS.guest);
  }

  if (customer.customerRole && customer.customerRole.status === "ACTIVE") {
    return customer.customerRole;
  }

  return ensureCustomerRoleByKey(mapLegacyCustomerTypeToRoleKey(customer.customerType));
}

async function validateRoleInput(input: CustomerRoleInput, currentId?: string) {
  const name = input.name?.trim();
  if (!name) throw new AppError("Customer role name is required.", 400);

  const key = normalizeRoleKey(input.key || input.name);
  if (!key) throw new AppError("Customer role key is required.", 400);

  const [duplicateName, duplicateKey] = await Promise.all([
    prisma.customerRole.findFirst({ where: { name, ...(currentId ? { id: { not: currentId } } : {}) }, select: { id: true } }),
    prisma.customerRole.findFirst({ where: { key, ...(currentId ? { id: { not: currentId } } : {}) }, select: { id: true } }),
  ]);

  if (duplicateName) throw new AppError("A customer role with this name already exists.", 409);
  if (duplicateKey) throw new AppError("A customer role with this key already exists.", 409);

  return {
    key,
    name,
    description: cleanOptional(input.description),
    status: input.status ?? "ACTIVE",
    sortOrder: Number(input.sortOrder ?? 0),
  };
}

export async function createCustomerRole(input: CustomerRoleInput) {
  const data = await validateRoleInput(input);
  return prisma.customerRole.create({
    data,
    include: { _count: { select: { customers: true } } },
  });
}

export async function updateCustomerRole(id: string, input: CustomerRoleInput) {
  const current = await prisma.customerRole.findUnique({
    where: { id },
    include: { _count: { select: { customers: true } } },
  });
  if (!current) throw new AppError("Customer role not found.", 404);

  const data = await validateRoleInput(
    {
      key: input.key ?? current.key,
      name: input.name ?? current.name,
      description: input.description ?? current.description,
      status: input.status ?? current.status,
      sortOrder: input.sortOrder ?? current.sortOrder,
    },
    id,
  );

  if (current.isSystem && data.key !== current.key) {
    throw new AppError("System customer role keys cannot be changed.", 400);
  }

  return prisma.customerRole.update({
    where: { id },
    data,
    include: { _count: { select: { customers: true } } },
  });
}

export async function deleteCustomerRole(id: string) {
  const role = await prisma.customerRole.findUnique({
    where: { id },
    include: { _count: { select: { customers: true } } },
  });
  if (!role) throw new AppError("Customer role not found.", 404);
  if (role.isSystem) throw new AppError("System customer roles cannot be deleted.", 400);
  if (role._count.customers > 0) {
    throw new AppError("Reassign customers before deleting this role.", 400);
  }

  await prisma.customerRole.delete({ where: { id } });
}

export async function assignCustomerRole(customerId: string, customerRoleId: string) {
  const [customer, role] = await Promise.all([
    prisma.customer.findUnique({ where: { id: customerId, deletedAt: null }, select: { id: true } }),
    prisma.customerRole.findUnique({ where: { id: customerRoleId } }),
  ]);

  if (!customer) throw new AppError("Customer not found.", 404);
  if (!role) throw new AppError("Customer role not found.", 404);
  if (role.status !== "ACTIVE") throw new AppError("Only active customer roles can be assigned.", 400);

  return prisma.customer.update({
    where: { id: customerId },
    data: { customerRoleId: role.id },
    include: { customerRole: true, tier: true, defaultCountry: true },
  });
}

export function buildRolePriceLayer(
  currentPrice: number,
  nextPrice: Prisma.Decimal | number,
  label: string,
) {
  const parsed = Number(nextPrice);
  return {
    nextPrice: parsed,
    layer: {
      type: "ROLE_PRICE" as const,
      label,
      amountBefore: currentPrice,
      amountAfter: parsed,
    },
  };
}
