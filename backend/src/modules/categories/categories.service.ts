import { prisma } from "../../config/database";
import { AppError, slugify } from "../../utils/apiResponse";

export async function listCategories() {
  return prisma.category.findMany({
    where: { deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { children: { where: { deletedAt: null } }, _count: { select: { products: true } } },
  });
}

export async function createCategory(data: { name: string; description?: string; parentId?: string; image?: string; sortOrder?: number }) {
  const slug = slugify(data.name);
  return prisma.category.create({ data: { ...data, slug } });
}

export async function updateCategory(id: string, data: Partial<Parameters<typeof createCategory>[0]>) {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw new AppError("Category not found.", 404);
  const ud = { ...data } as Record<string, unknown>;
  if (data.name) ud.slug = slugify(data.name);
  return prisma.category.update({ where: { id }, data: ud });
}

export async function deleteCategory(id: string) {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw new AppError("Category not found.", 404);
  return prisma.category.update({ where: { id }, data: { deletedAt: new Date() } });
}
