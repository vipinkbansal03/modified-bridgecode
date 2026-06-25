import { prisma } from "../../config/database";
import { AppError, slugify } from "../../utils/apiResponse";
import type { Status } from "@prisma/client";

export const listAttributes = () =>
  prisma.attribute.findMany({
    where: { status: "ACTIVE" },
    include: {
      values: {
        where: { status: "ACTIVE" },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
export async function createAttribute(data: { name: string }) {
  const slug = slugify(data.name);
  const existing = await prisma.attribute.findFirst({ where: { slug, status: "ACTIVE" } });
  if (existing) throw new AppError("An attribute with this name already exists.", 409);
  return prisma.attribute.create({ data: { name: data.name, slug } });
}
export async function updateAttribute(id: string, data: { name?: string; status?: Status }) {
  const e = await prisma.attribute.findUnique({ where: { id } });
  if (!e) throw new AppError("Attribute not found.", 404);
  if (data.name) {
    const slug = slugify(data.name);
    const existing = await prisma.attribute.findFirst({ where: { slug, status: "ACTIVE", NOT: { id } } });
    if (existing) throw new AppError("An attribute with this name already exists.", 409);
  }
  return prisma.attribute.update({ where: { id }, data: { ...data, ...(data.name && { slug: slugify(data.name) }) } });
}
export const deleteAttribute = (id: string) => prisma.attribute.update({ where: { id }, data: { status: "INACTIVE" as Status } });
export async function addAttributeValue(attributeId: string, data: { value: string; sortOrder?: number }) {
  const slug = slugify(data.value);
  const existing = await prisma.attributeValue.findFirst({ where: { attributeId, slug } });
  if (existing?.status === "ACTIVE") throw new AppError("This value already exists for the selected attribute.", 409);
  if (existing) {
    return prisma.attributeValue.update({
      where: { id: existing.id },
      data: { value: data.value, slug, sortOrder: data.sortOrder ?? existing.sortOrder, status: "ACTIVE" },
    });
  }
  return prisma.attributeValue.create({ data: { attributeId, value: data.value, slug, sortOrder: data.sortOrder ?? 0 } });
}
export async function updateAttributeValue(id: string, data: { value?: string; sortOrder?: number; status?: Status }) {
  const current = await prisma.attributeValue.findUnique({ where: { id } });
  if (!current) throw new AppError("Attribute value not found.", 404);
  if (data.value) {
    const slug = slugify(data.value);
    const existing = await prisma.attributeValue.findFirst({
      where: { attributeId: current.attributeId, slug, NOT: { id } },
    });
    if (existing) throw new AppError("This value already exists for the selected attribute.", 409);
  }
  return prisma.attributeValue.update({ where: { id }, data: { ...data, ...(data.value && { slug: slugify(data.value) }) } });
}
export async function deleteAttributeValue(id: string) {
  const current = await prisma.attributeValue.findUnique({ where: { id } });
  if (!current) throw new AppError("Attribute value not found.", 404);
  return prisma.attributeValue.update({ where: { id }, data: { status: "INACTIVE" as Status } });
}
