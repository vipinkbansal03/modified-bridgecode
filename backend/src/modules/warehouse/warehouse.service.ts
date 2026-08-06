import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { AppError, getPagination } from "../../utils/apiResponse";

function validateGstin(countryCode: string, gstin?: string | null) {
  if (countryCode.toUpperCase() === "IN") {
    if (!gstin || !gstin.trim()) return false;
    // Basic GSTIN format: 15 chars, alphanumeric
    if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(gstin.trim())) {
      return false;
    }
  }
  return true;
}

export async function listWarehouses(query: {
  page?: string;
  limit?: string;
  search?: string;
  requestingUserId?: string;
}) {
  const { page, limit, skip } = getPagination(query);
  const where: Prisma.WarehouseWhereInput = {};

  if (query.search?.trim()) {
    where.OR = [
      { name: { contains: query.search.trim(), mode: "insensitive" } },
      { gstin: { contains: query.search.trim(), mode: "insensitive" } },
    ];
  }

  if (query.requestingUserId) {
    const user = await prisma.user.findUnique({
      where: { id: query.requestingUserId },
      include: { role: true }
    });
    if (user && !["Super Admin", "Admin"].includes(user.role.name)) {
      const userWarehouses = await prisma.userWarehouse.findMany({
        where: { userId: query.requestingUserId },
        select: { warehouseId: true }
      });
      if (userWarehouses.length > 0) {
        const allowedIds = userWarehouses.map((uw) => uw.warehouseId);
        where.id = { in: allowedIds };
      }
    }
  }

  const [data, total] = await Promise.all([
    prisma.warehouse.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { country: true }
    }),
    prisma.warehouse.count({ where }),
  ]);

  return { data, total, page, limit };
}

export async function createWarehouse(data: {
  name: string;
  countryId: string;
  state?: string;
  address?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  postalCode?: string;
  gstin?: string;
  deliveryZones?: { countryId: string; states: string[] }[];
  status: any;
}) {
  const country = await prisma.country.findUnique({ where: { id: data.countryId } });
  if (!country) throw new AppError("Country not found.", 404);

  if (data.status === "ACTIVE" && country.code === "IN" && data.gstin && !validateGstin(country.code, data.gstin)) {
    throw new AppError("The provided GSTIN format is invalid.", 400);
  }

  const formattedAddress = data.address || [
    data.addressLine1,
    data.addressLine2,
    data.city,
    data.postalCode
  ].filter(Boolean).join(", ");

  return prisma.warehouse.create({ data: {
    name: data.name,
    countryId: data.countryId,
    status: data.status,
    state: data.state ?? "",
    address: formattedAddress,
    addressLine1: data.addressLine1 ?? null,
    addressLine2: data.addressLine2 ?? null,
    city: data.city ?? null,
    postalCode: data.postalCode ?? null,
    gstin: data.gstin ?? "",
    deliveryZones: data.deliveryZones ? JSON.parse(JSON.stringify(data.deliveryZones)) : []
  } });
}

export async function updateWarehouse(id: string, data: {
  name?: string;
  countryId?: string;
  state?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  postalCode?: string;
  gstin?: string;
  deliveryZones?: { countryId: string; states: string[] }[];
  status?: any;
}) {
  const existing = await prisma.warehouse.findUnique({
    where: { id },
    include: { country: true }
  });
  if (!existing) throw new AppError("Warehouse not found.", 404);

  let targetCountry = existing.country;
  if (data.countryId && data.countryId !== existing.countryId) {
    const c = await prisma.country.findUnique({ where: { id: data.countryId } });
    if (!c) throw new AppError("Country not found.", 404);
    targetCountry = c;
  }

  const nextStatus = data.status ?? existing.status;
  const nextGstin = data.gstin ?? existing.gstin;

  if (nextStatus === "ACTIVE" && targetCountry.code === "IN" && nextGstin && !validateGstin(targetCountry.code, nextGstin)) {
    throw new AppError("The provided GSTIN format is invalid.", 400);
  }

  const nextLine1 = data.addressLine1 !== undefined ? data.addressLine1 : existing.addressLine1;
  const nextLine2 = data.addressLine2 !== undefined ? data.addressLine2 : existing.addressLine2;
  const nextCity = data.city !== undefined ? data.city : existing.city;
  const nextPostalCode = data.postalCode !== undefined ? data.postalCode : existing.postalCode;
  
  const formattedAddress = [nextLine1, nextLine2, nextCity, nextPostalCode].filter(Boolean).join(", ");

  return prisma.warehouse.update({
    where: { id },
    data: {
      ...(data.name && { name: data.name }),
      ...(data.countryId && { countryId: data.countryId }),
      ...(data.state !== undefined && { state: data.state }),
      ...(data.addressLine1 !== undefined && { addressLine1: data.addressLine1 }),
      ...(data.addressLine2 !== undefined && { addressLine2: data.addressLine2 }),
      ...(data.city !== undefined && { city: data.city }),
      ...(data.postalCode !== undefined && { postalCode: data.postalCode }),
      ...(data.gstin !== undefined && { gstin: data.gstin }),
      ...(data.deliveryZones !== undefined && { deliveryZones: data.deliveryZones ? JSON.parse(JSON.stringify(data.deliveryZones)) : [] }),
      ...(data.status && { status: data.status }),
      address: formattedAddress,
    }
  });
}

export async function deleteWarehouse(id: string) {
  const count = await prisma.inventory.count({ where: { warehouseId: id } });
  if (count > 0) throw new AppError("Cannot delete warehouse with associated inventory.", 400);
  return prisma.warehouse.delete({ where: { id } });
}
