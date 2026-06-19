import { prisma } from "../../config/database";
export const listRoles = () => prisma.role.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { users: true } } } });
export const createRole = (data: { name: string; permissions: string[] }) => prisma.role.create({ data: { name: data.name, permissions: data.permissions } });
export const updateRole = (id: string, data: { name?: string; permissions?: string[] }) => prisma.role.update({ where: { id }, data: data as never });
export const deleteRole = (id: string) => prisma.role.delete({ where: { id } });
