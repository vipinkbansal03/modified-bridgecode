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
} as const;

export const listUsers = () =>
  prisma.user.findMany({ where: { deletedAt: null }, select: userSelect });

export async function createUser(data: {
  name: string;
  email: string;
  password: string;
  roleId: string;
}) {
  const pw = await bcrypt.hash(data.password, 12);
  return prisma.user.create({
    data: { ...data, password: pw },
    select: userSelect,
  });
}

export const getUser = (id: string) =>
  prisma.user.findUnique({
    where: { id, deletedAt: null },
    select: userSelect,
  });

export async function updateUser(id: string, data: any) {
  const payload = { ...data };
  if (payload.password) {
    payload.password = await bcrypt.hash(payload.password, 12);
  } else {
    delete payload.password;
  }
  return prisma.user.update({
    where: { id },
    data: payload,
    select: userSelect,
  });
}

export const deleteUser = (id: string) =>
  prisma.user.update({ where: { id }, data: { deletedAt: new Date() } });
