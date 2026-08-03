import { prisma } from "../../config/database";
import { AppError } from "../../utils/apiResponse";
import bcrypt from "bcryptjs";

const userSelect = {
  id: true,
  name: true,
  email: true,
  roleId: true,
  role: true,
  status: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  warehouses: {
    select: {
      warehouseId: true,
    },
  },
} as const;

export const listUsers = () =>
  prisma.user.findMany({ where: { deletedAt: null }, select: userSelect });

export async function createUser(data: {
  name: string;
  email: string;
  password: string;
  roleId: string;
  warehouseIds?: string[];
}) {
  const { warehouseIds, ...rest } = data;
  const pw = await bcrypt.hash(rest.password, 12);
  
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { ...rest, password: pw },
      select: userSelect,
    });
    if (warehouseIds && warehouseIds.length > 0) {
      await tx.userWarehouse.createMany({
        data: warehouseIds.map((wId) => ({
          userId: user.id,
          warehouseId: wId,
        })),
      });
    }
    return tx.user.findUnique({
      where: { id: user.id },
      select: userSelect,
    });
  });
}

export const getUser = (id: string) =>
  prisma.user.findUnique({
    where: { id, deletedAt: null },
    select: userSelect,
  });

export async function updateUser(id: string, data: any) {
  const { warehouseIds, ...rest } = data;
  const payload = { ...rest };
  if (payload.password) {
    payload.password = await bcrypt.hash(payload.password, 12);
  } else {
    delete payload.password;
  }

  return prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: payload,
    });

    if (warehouseIds !== undefined) {
      await tx.userWarehouse.deleteMany({
        where: { userId: id },
      });
      if (warehouseIds.length > 0) {
        await tx.userWarehouse.createMany({
          data: warehouseIds.map((wId: string) => ({
            userId: id,
            warehouseId: wId,
          })),
        });
      }
    }

    return tx.user.findUnique({
      where: { id },
      select: userSelect,
    });
  });
}

export const deleteUser = (id: string) =>
  prisma.user.update({ where: { id }, data: { deletedAt: new Date() } });
