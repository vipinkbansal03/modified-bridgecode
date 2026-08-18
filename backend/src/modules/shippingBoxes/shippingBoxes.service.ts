import { prisma } from "../../config/database";
import { AppError } from "../../utils/apiResponse";

type BoxInput = {
  name: string;
  length: number;
  width: number;
  height: number;
  maxWeight: number;
  isActive?: boolean;
  countryIds?: string[];
};

export async function listBoxes() {
  return prisma.shippingBox.findMany({
    include: { countries: { include: { country: true } } },
    orderBy: { name: "asc" },
  });
}

export async function getBox(id: string) {
  const box = await prisma.shippingBox.findUnique({
    where: { id },
    include: { countries: { include: { country: true } } },
  });
  if (!box) throw new AppError("Shipping box not found.", 404);
  return box;
}

export async function createBox(data: BoxInput) {
  if (!data.name?.trim()) throw new AppError("Box name is required.", 400);

  const countryIds = [...new Set(data.countryIds ?? [])];
  if (countryIds.length === 0) throw new AppError("At least one country is required.", 400);
  const foundCountries = await prisma.country.findMany({ where: { id: { in: countryIds } }, select: { id: true } });
  if (foundCountries.length !== countryIds.length) throw new AppError("One or more countries were not found.", 404);

  return prisma.shippingBox.create({
    data: {
      name: data.name.trim(),
      length: data.length,
      width: data.width,
      height: data.height,
      maxWeight: data.maxWeight,
      isActive: data.isActive ?? true,
      countries: { create: countryIds.map((countryId) => ({ countryId })) },
    },
    include: { countries: { include: { country: true } } },
  });
}

export async function updateBox(id: string, data: Partial<BoxInput>) {
  await getBox(id);

  let countriesData: { deleteMany: Record<string, never>; create: { countryId: string }[] } | undefined;
  if (data.countryIds) {
    const countryIds = [...new Set(data.countryIds)];
    if (countryIds.length === 0) throw new AppError("At least one country is required.", 400);
    const foundCountries = await prisma.country.findMany({ where: { id: { in: countryIds } }, select: { id: true } });
    if (foundCountries.length !== countryIds.length) throw new AppError("One or more countries were not found.", 404);
    countriesData = { deleteMany: {}, create: countryIds.map((countryId) => ({ countryId })) };
  }

  return prisma.shippingBox.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.length !== undefined ? { length: data.length } : {}),
      ...(data.width !== undefined ? { width: data.width } : {}),
      ...(data.height !== undefined ? { height: data.height } : {}),
      ...(data.maxWeight !== undefined ? { maxWeight: data.maxWeight } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      ...(countriesData ? { countries: countriesData } : {}),
    },
    include: { countries: { include: { country: true } } },
  });
}

export async function deleteBox(id: string) {
  await getBox(id);
  await prisma.shippingBox.delete({ where: { id } });
}

export async function toggleBox(id: string) {
  const box = await getBox(id);
  return prisma.shippingBox.update({
    where: { id },
    data: { isActive: !box.isActive },
  });
}

export async function bulkUpdateBoxes(input: { ids: string[]; action: "ENABLE" | "DISABLE" | "DELETE" }) {
  const { ids, action } = input;
  if (!ids || ids.length === 0) {
    throw new AppError("No shipping box IDs provided.", 400);
  }

  if (action === "DELETE") {
    await prisma.shippingBoxCountry.deleteMany({ where: { boxId: { in: ids } } });
    const result = await prisma.shippingBox.deleteMany({ where: { id: { in: ids } } });
    return { affected: result.count };
  }

  const nextActive = action === "ENABLE";
  const result = await prisma.shippingBox.updateMany({
    where: { id: { in: ids } },
    data: { isActive: nextActive },
  });
  return { affected: result.count };
}
