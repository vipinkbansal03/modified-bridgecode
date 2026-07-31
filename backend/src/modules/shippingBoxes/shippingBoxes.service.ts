import { prisma } from "../../config/database";
import { AppError } from "../../utils/apiResponse";

type BoxInput = {
  name: string;
  length: number;
  width: number;
  height: number;
  maxWeight: number;
  isActive?: boolean;
};

export async function listBoxes() {
  return prisma.shippingBox.findMany({ orderBy: { name: "asc" } });
}

export async function getBox(id: string) {
  const box = await prisma.shippingBox.findUnique({ where: { id } });
  if (!box) throw new AppError("Shipping box not found.", 404);
  return box;
}

export async function createBox(data: BoxInput) {
  if (!data.name?.trim()) throw new AppError("Box name is required.", 400);
  return prisma.shippingBox.create({
    data: {
      name: data.name.trim(),
      length: data.length,
      width: data.width,
      height: data.height,
      maxWeight: data.maxWeight,
      isActive: data.isActive ?? true,
    },
  });
}

export async function updateBox(id: string, data: Partial<BoxInput>) {
  await getBox(id);
  return prisma.shippingBox.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.length !== undefined ? { length: data.length } : {}),
      ...(data.width !== undefined ? { width: data.width } : {}),
      ...(data.height !== undefined ? { height: data.height } : {}),
      ...(data.maxWeight !== undefined ? { maxWeight: data.maxWeight } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
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
