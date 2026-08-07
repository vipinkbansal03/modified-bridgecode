import { BlogStatus, Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { AppError, getPagination, slugify } from "../../utils/apiResponse";

type BlogInput = {
  title?: string;
  slug?: string;
  content?: string;
  excerpt?: string | null;
  featuredImage?: string | null;
  authorId?: string | null;
  categoryId?: string | null;
  tags?: string[];
  status?: BlogStatus;
  publishedAt?: string | Date | null;
  scheduledAt?: string | Date | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
};

const blogInclude = {
  author: true,
  category: true,
} satisfies Prisma.BlogInclude;

function optionalDate(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new AppError("Invalid date value.", 400);
  return date;
}

async function assertBlogSlug(slug: string, excludeId?: string) {
  const existing = await prisma.blog.findFirst({ where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) } });
  if (existing) throw new AppError("A blog with this slug already exists.", 409);
}

async function normalizeBlog(input: BlogInput, current?: BlogInput) {
  const merged = { ...(current ?? {}), ...input };
  const title = merged.title?.trim();
  if (!title) throw new AppError("Blog title is required.", 400);
  const slug = slugify(merged.slug?.trim() || title);
  if (!slug) throw new AppError("Blog slug is required.", 400);
  const content = merged.content?.trim();
  if (!content) throw new AppError("Blog content is required.", 400);
  const status = merged.status ?? "DRAFT";
  return {
    title,
    slug,
    content,
    excerpt: merged.excerpt?.trim() || null,
    featuredImage: merged.featuredImage?.trim() || null,
    authorId: merged.authorId || null,
    categoryId: merged.categoryId || null,
    tags: Array.isArray(merged.tags) ? merged.tags.map((tag) => tag.trim()).filter(Boolean) : [],
    status,
    publishedAt: status === "PUBLISHED" ? optionalDate(merged.publishedAt) ?? new Date() : optionalDate(merged.publishedAt),
    scheduledAt: status === "SCHEDULED" ? optionalDate(merged.scheduledAt) : optionalDate(merged.scheduledAt),
    seoTitle: merged.seoTitle?.trim() || null,
    seoDescription: merged.seoDescription?.trim() || null,
  };
}

export async function listBlogs(query: { page?: string; limit?: string; status?: BlogStatus; categoryId?: string; authorId?: string; search?: string }) {
  const { page, limit, skip } = getPagination(query);
  const where: Prisma.BlogWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(query.authorId ? { authorId: query.authorId } : {}),
    ...(query.search?.trim() ? { title: { contains: query.search.trim(), mode: "insensitive" } } : {}),
  };
  const [data, total] = await Promise.all([
    prisma.blog.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" }, include: blogInclude }),
    prisma.blog.count({ where }),
  ]);
  return { data, total, page, limit };
}

export async function getBlog(id: string) {
  const blog = await prisma.blog.findUnique({ where: { id }, include: blogInclude });
  if (!blog) throw new AppError("Blog not found.", 404);
  return blog;
}

export async function createBlog(input: BlogInput) {
  const data = await normalizeBlog(input);
  await assertBlogSlug(data.slug);
  return prisma.blog.create({ data, include: blogInclude });
}

export async function updateBlog(id: string, input: BlogInput) {
  const current = await getBlog(id);
  const data = await normalizeBlog(input, current);
  await assertBlogSlug(data.slug, id);
  return prisma.blog.update({ where: { id }, data, include: blogInclude });
}

export async function deleteBlog(id: string) {
  await getBlog(id);
  await prisma.blog.delete({ where: { id } });
}

export async function bulkUpdateBlogs(input: { ids?: string[]; action?: "publish" | "unpublish" | "delete" }) {
  const ids = Array.from(new Set(input.ids ?? []));
  if (!ids.length) throw new AppError("Select at least one blog.", 400);
  const found = await prisma.blog.count({ where: { id: { in: ids } } });
  if (found !== ids.length) throw new AppError("One or more blogs were not found.", 400);
  if (input.action === "delete") {
    await prisma.blog.deleteMany({ where: { id: { in: ids } } });
    return { updated: ids.length };
  }
  if (input.action === "publish") {
    await prisma.blog.updateMany({ where: { id: { in: ids } }, data: { status: "PUBLISHED", publishedAt: new Date() } });
    return { updated: ids.length };
  }
  if (input.action === "unpublish") {
    await prisma.blog.updateMany({ where: { id: { in: ids } }, data: { status: "DRAFT" } });
    return { updated: ids.length };
  }
  throw new AppError("Unsupported bulk action.", 400);
}

export async function listBlogCategories() {
  return prisma.blogCategory.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { blogs: true } } } });
}

export async function createBlogCategory(input: { name?: string; slug?: string; description?: string | null }) {
  const name = input.name?.trim();
  if (!name) throw new AppError("Category name is required.", 400);
  const slug = slugify(input.slug?.trim() || name);
  if (!slug) throw new AppError("Category slug is required.", 400);
  return prisma.blogCategory.create({ data: { name, slug, description: input.description?.trim() || null } });
}

export async function updateBlogCategory(id: string, input: { name?: string; slug?: string; description?: string | null }) {
  const current = await prisma.blogCategory.findUnique({ where: { id } });
  if (!current) throw new AppError("Blog category not found.", 404);
  const name = input.name?.trim() || current.name;
  const slug = slugify(input.slug?.trim() || name);
  return prisma.blogCategory.update({ where: { id }, data: { name, slug, description: input.description?.trim() || null } });
}

export async function deleteBlogCategory(id: string) {
  const count = await prisma.blog.count({ where: { categoryId: id } });
  if (count > 0) throw new AppError("Cannot delete category while blogs use it.", 400);
  await prisma.blogCategory.delete({ where: { id } });
}

export async function listBlogAuthors() {
  return prisma.blogAuthor.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { blogs: true } } } });
}

export async function createBlogAuthor(input: { name?: string; bio?: string | null; avatar?: string | null; userId?: string | null }) {
  const name = input.name?.trim();
  if (!name) throw new AppError("Author name is required.", 400);
  return prisma.blogAuthor.create({ data: { name, bio: input.bio?.trim() || null, avatar: input.avatar?.trim() || null, userId: input.userId || null } });
}

export async function updateBlogAuthor(id: string, input: { name?: string; bio?: string | null; avatar?: string | null; userId?: string | null }) {
  const current = await prisma.blogAuthor.findUnique({ where: { id } });
  if (!current) throw new AppError("Blog author not found.", 404);
  return prisma.blogAuthor.update({
    where: { id },
    data: {
      name: input.name?.trim() || current.name,
      bio: input.bio?.trim() || null,
      avatar: input.avatar?.trim() || null,
      userId: input.userId || null,
    },
  });
}

export async function deleteBlogAuthor(id: string) {
  const count = await prisma.blog.count({ where: { authorId: id } });
  if (count > 0) throw new AppError("Cannot delete author while blogs use them.", 400);
  await prisma.blogAuthor.delete({ where: { id } });
}

export async function listPublicBlogs(query: { page?: string; limit?: string; search?: string; categoryId?: string; authorId?: string }) {
  const { page, limit, skip } = getPagination(query);
  const searchTrim = query.search?.trim();

  const where: Prisma.BlogWhereInput = {
    status: "PUBLISHED",
    OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }],
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(query.authorId ? { authorId: query.authorId } : {}),
    ...(searchTrim
      ? {
          AND: [
            {
              OR: [
                { title: { contains: searchTrim, mode: "insensitive" } },
                { excerpt: { contains: searchTrim, mode: "insensitive" } },
                { content: { contains: searchTrim, mode: "insensitive" } },
              ],
            },
          ],
        }
      : {}),
  };
  const [data, total] = await Promise.all([
    prisma.blog.findMany({ where, skip, take: limit, orderBy: { publishedAt: "desc" }, include: blogInclude }),
    prisma.blog.count({ where }),
  ]);
  return { data, total, page, limit };
}

export async function getPublicBlog(slug: string) {
  const blog = await prisma.blog.findFirst({
    where: { slug, status: "PUBLISHED", OR: [{ publishedAt: null }, { publishedAt: { lte: new Date() } }] },
    include: blogInclude,
  });
  if (!blog) throw new AppError("Blog not found.", 404);
  return blog;
}
