import { prisma } from "../../config/database";
import { AppError } from "../../utils/apiResponse";

export async function listCustomerAddresses(customerId: string) {
  return prisma.customerAddress.findMany({
    where: { customerId },
    include: { country: true },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
}

export async function createCustomerAddress(
  customerId: string,
  data: {
    label?: string;
    fullName: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state: string;
    postalCode: string;
    countryId?: string;
    country?: string;
    isDefault?: boolean;
  }
) {
  let countryId = data.countryId;
  if (!countryId && data.country) {
    const c = await prisma.country.findFirst({
      where: {
        status: "ACTIVE",
        OR: [
          { code: data.country.toUpperCase() },
          { name: { equals: data.country, mode: "insensitive" } },
        ],
      },
    });
    if (c) countryId = c.id;
  }

  if (!countryId) {
    const firstCountry = await prisma.country.findFirst({ where: { status: "ACTIVE" } });
    if (!firstCountry) throw new AppError("No valid country found.", 400);
    countryId = firstCountry.id;
  }

  return prisma.$transaction(async (tx) => {
    if (data.isDefault) {
      await tx.customerAddress.updateMany({
        where: { customerId },
        data: { isDefault: false },
      });
    }

    const count = await tx.customerAddress.count({ where: { customerId } });
    const isDefault = data.isDefault || count === 0;

    return tx.customerAddress.create({
      data: {
        customerId,
        label: data.label?.trim() || "Address",
        fullName: data.fullName.trim(),
        phone: data.phone.trim(),
        addressLine1: data.addressLine1.trim(),
        addressLine2: data.addressLine2?.trim() || null,
        city: data.city.trim(),
        state: data.state.trim(),
        postalCode: data.postalCode.trim(),
        countryId,
        isDefault,
      },
      include: { country: true },
    });
  });
}

export async function updateCustomerAddress(
  customerId: string,
  addressId: string,
  data: {
    label?: string;
    fullName?: string;
    phone?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    countryId?: string;
    country?: string;
    isDefault?: boolean;
  }
) {
  const existing = await prisma.customerAddress.findFirst({
    where: { id: addressId, customerId },
  });
  if (!existing) throw new AppError("Address not found.", 404);

  let countryId = data.countryId;
  if (!countryId && data.country) {
    const c = await prisma.country.findFirst({
      where: {
        status: "ACTIVE",
        OR: [
          { code: data.country.toUpperCase() },
          { name: { equals: data.country, mode: "insensitive" } },
        ],
      },
    });
    if (c) countryId = c.id;
  }

  return prisma.$transaction(async (tx) => {
    if (data.isDefault) {
      await tx.customerAddress.updateMany({
        where: { customerId },
        data: { isDefault: false },
      });
    }

    return tx.customerAddress.update({
      where: { id: addressId },
      data: {
        ...(data.label !== undefined && { label: data.label.trim() }),
        ...(data.fullName !== undefined && { fullName: data.fullName.trim() }),
        ...(data.phone !== undefined && { phone: data.phone.trim() }),
        ...(data.addressLine1 !== undefined && { addressLine1: data.addressLine1.trim() }),
        ...(data.addressLine2 !== undefined && { addressLine2: data.addressLine2?.trim() || null }),
        ...(data.city !== undefined && { city: data.city.trim() }),
        ...(data.state !== undefined && { state: data.state.trim() }),
        ...(data.postalCode !== undefined && { postalCode: data.postalCode.trim() }),
        ...(countryId && { countryId }),
        ...(data.isDefault !== undefined && { isDefault: data.isDefault }),
      },
      include: { country: true },
    });
  });
}

export async function deleteCustomerAddress(customerId: string, addressId: string) {
  const existing = await prisma.customerAddress.findFirst({
    where: { id: addressId, customerId },
  });
  if (!existing) throw new AppError("Address not found.", 404);

  await prisma.customerAddress.delete({ where: { id: addressId } });

  if (existing.isDefault) {
    const remaining = await prisma.customerAddress.findFirst({
      where: { customerId },
      orderBy: { createdAt: "desc" },
    });
    if (remaining) {
      await prisma.customerAddress.update({
        where: { id: remaining.id },
        data: { isDefault: true },
      });
    }
  }

  return { success: true };
}

export async function setDefaultCustomerAddress(customerId: string, addressId: string) {
  const existing = await prisma.customerAddress.findFirst({
    where: { id: addressId, customerId },
  });
  if (!existing) throw new AppError("Address not found.", 404);

  await prisma.$transaction([
    prisma.customerAddress.updateMany({
      where: { customerId },
      data: { isDefault: false },
    }),
    prisma.customerAddress.update({
      where: { id: addressId },
      data: { isDefault: true },
    }),
  ]);

  return prisma.customerAddress.findUnique({
    where: { id: addressId },
    include: { country: true },
  });
}
