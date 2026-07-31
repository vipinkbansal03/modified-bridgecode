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
}) {
  const { page, limit, skip } = getPagination(query);
  const where: Prisma.WarehouseWhereInput = {};

  if (query.search?.trim()) {
    where.OR = [
      { name: { contains: query.search.trim(), mode: "insensitive" } },
      { gstin: { contains: query.search.trim(), mode: "insensitive" } },
    ];
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
  gstin?: string;
  status: any;
}) {
  const country = await prisma.country.findUnique({ where: { id: data.countryId } });
  if (!country) throw new AppError("Country not found.", 404);

  if (data.status === "ACTIVE" && country.code === "IN" && !validateGstin(country.code, data.gstin)) {
    throw new AppError("A valid GSTIN is required to activate an India warehouse.", 400);
  }

  return prisma.warehouse.create({ data: {
    name: data.name,
    countryId: data.countryId,
    status: data.status,
    state: data.state ?? "",
    address: data.address ?? "",
    gstin: data.gstin ?? ""
  } });
}

export async function updateWarehouse(id: string, data: {
  name?: string;
  countryId?: string;
  state?: string;
  address?: string;
  gstin?: string;
  status?: any;
}) {
  const existing = await prisma.warehouse.findUnique({ where: { id }, include: { country: true } });
  if (!existing) throw new AppError("Warehouse not found.", 404);

  const finalCountryId = data.countryId || existing.countryId;
  const country = await prisma.country.findUnique({ where: { id: finalCountryId } });
  if (!country) throw new AppError("Country not found.", 404);

  const finalStatus = data.status ?? existing.status;
  const finalGstin = data.gstin !== undefined ? data.gstin : existing.gstin;

  if (finalStatus === "ACTIVE" && country.code === "IN" && !validateGstin(country.code, finalGstin)) {
    throw new AppError("A valid GSTIN is required to activate an India warehouse.", 400);
  }

  return prisma.warehouse.update({ where: { id }, data: {
    name: data.name,
    countryId: data.countryId,
    status: data.status,
    state: data.state,
    address: data.address,
    gstin: data.gstin
  } });
}

export async function deleteWarehouse(id: string) {
  const count = await prisma.inventory.count({ where: { warehouseId: id } });
  if (count > 0) throw new AppError("Cannot delete warehouse with associated inventory.", 400);
  return prisma.warehouse.delete({ where: { id } });
}
