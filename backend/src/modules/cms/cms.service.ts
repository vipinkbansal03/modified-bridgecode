import { prisma } from "../../config/database";
import { AppError, getPagination } from "../../utils/apiResponse";

// ─── Types ────────────────────────────────────────────────────────────────────

type PageBody = { title: string; slug: string; pageKey: string; status?: string; seoTitle?: string; seoDescription?: string; seoKeywords?: string; ogTitle?: string; ogDescription?: string; ogImage?: string };
type SectionBody = { sectionKey: string; title?: string; subtitle?: string; description?: string; layoutType?: string; sortOrder?: number; status?: string; settingsJson?: object };
type BlockBody = { blockType: string; title?: string; subtitle?: string; description?: string; image?: string; icon?: string; linkLabel?: string; linkUrl?: string; sortOrder?: number; status?: string; dataJson?: object };
type FooterBody = { title?: string; description?: string; logo?: string; address?: string; email?: string; phone?: string; socialLinksJson?: object; newsletterEnabled?: boolean; status?: string };
type MenuBody = { name: string; location: string; status?: string };
type MenuItemBody = { parentId?: string; label: string; url: string; sortOrder?: number; openInNewTab?: boolean; status?: string };

// ─── Pages ────────────────────────────────────────────────────────────────────

export async function listPages(query: { page?: string; limit?: string; status?: string }) {
  const { page, limit, skip } = getPagination(query);
  const where = query.status ? { status: query.status } : {};
  const [data, total] = await Promise.all([
    prisma.cMSPage.findMany({ where, skip, take: limit, orderBy: { updatedAt: "desc" }, include: { _count: { select: { sections: true } } } }),
    prisma.cMSPage.count({ where }),
  ]);
  return { data, total, page, limit };
}

export async function createPage(body: PageBody) {
  return prisma.cMSPage.create({ data: body });
}

export async function getPage(id: string) {
  const p = await prisma.cMSPage.findUnique({
    where: { id },
    include: { sections: { orderBy: { sortOrder: "asc" }, include: { blocks: { orderBy: { sortOrder: "asc" } } } } },
  });
  if (!p) throw new AppError("Page not found.", 404);
  return p;
}

export async function updatePage(id: string, body: Partial<PageBody>) {
  await getPage(id);
  return prisma.cMSPage.update({ where: { id }, data: body });
}

export async function deletePage(id: string) {
  await getPage(id);
  return prisma.cMSPage.delete({ where: { id } });
}

// ─── Sections ─────────────────────────────────────────────────────────────────

export async function listSections(pageId: string) {
  return prisma.cMSSection.findMany({
    where: { pageId },
    orderBy: { sortOrder: "asc" },
    include: { blocks: { orderBy: { sortOrder: "asc" } } },
  });
}

export async function createSection(pageId: string, body: SectionBody) {
  const page = await prisma.cMSPage.findUnique({ where: { id: pageId } });
  if (!page) throw new AppError("Page not found.", 404);
  return prisma.cMSSection.create({ data: { pageId, ...body } });
}

export async function getSection(id: string) {
  const s = await prisma.cMSSection.findUnique({ where: { id }, include: { blocks: { orderBy: { sortOrder: "asc" } } } });
  if (!s) throw new AppError("Section not found.", 404);
  return s;
}

export async function updateSection(id: string, body: Partial<SectionBody>) {
  await getSection(id);
  return prisma.cMSSection.update({ where: { id }, data: body });
}

export async function deleteSection(id: string) {
  await getSection(id);
  return prisma.cMSSection.delete({ where: { id } });
}

export async function reorderSections(pageId: string, orderedIds: string[]) {
  await Promise.all(orderedIds.map((id, idx) => prisma.cMSSection.update({ where: { id }, data: { sortOrder: idx } })));
  return listSections(pageId);
}

// ─── Blocks ───────────────────────────────────────────────────────────────────

export async function listBlocks(sectionId: string) {
  return prisma.cMSBlock.findMany({ where: { sectionId }, orderBy: { sortOrder: "asc" } });
}

export async function createBlock(sectionId: string, body: BlockBody) {
  const s = await prisma.cMSSection.findUnique({ where: { id: sectionId } });
  if (!s) throw new AppError("Section not found.", 404);
  return prisma.cMSBlock.create({ data: { sectionId, ...body } });
}

export async function getBlock(id: string) {
  const b = await prisma.cMSBlock.findUnique({ where: { id } });
  if (!b) throw new AppError("Block not found.", 404);
  return b;
}

export async function updateBlock(id: string, body: Partial<BlockBody>) {
  await getBlock(id);
  return prisma.cMSBlock.update({ where: { id }, data: body });
}

export async function deleteBlock(id: string) {
  await getBlock(id);
  return prisma.cMSBlock.delete({ where: { id } });
}

export async function reorderBlocks(sectionId: string, orderedIds: string[]) {
  await Promise.all(orderedIds.map((id, idx) => prisma.cMSBlock.update({ where: { id }, data: { sortOrder: idx } })));
  return listBlocks(sectionId);
}

// ─── Footer ───────────────────────────────────────────────────────────────────

export async function getFooter() {
  return prisma.cMSFooter.findFirst({ orderBy: { createdAt: "asc" } });
}

export async function upsertFooter(body: FooterBody) {
  const existing = await prisma.cMSFooter.findFirst();
  if (existing) return prisma.cMSFooter.update({ where: { id: existing.id }, data: body });
  return prisma.cMSFooter.create({ data: body });
}

// ─── Menus ────────────────────────────────────────────────────────────────────

export async function listMenus() {
  return prisma.cMSMenu.findMany({ include: { items: { orderBy: { sortOrder: "asc" } } } });
}

export async function createMenu(body: MenuBody) {
  return prisma.cMSMenu.create({ data: body, include: { items: true } });
}

export async function getMenu(id: string) {
  const m = await prisma.cMSMenu.findUnique({ where: { id }, include: { items: { orderBy: { sortOrder: "asc" } } } });
  if (!m) throw new AppError("Menu not found.", 404);
  return m;
}

export async function updateMenu(id: string, body: Partial<MenuBody>) {
  await getMenu(id);
  return prisma.cMSMenu.update({ where: { id }, data: body, include: { items: true } });
}

export async function deleteMenu(id: string) {
  await getMenu(id);
  return prisma.cMSMenu.delete({ where: { id } });
}

export async function createMenuItem(menuId: string, body: MenuItemBody) {
  return prisma.cMSMenuItem.create({ data: { menuId, ...body } });
}

export async function updateMenuItem(id: string, body: Partial<MenuItemBody>) {
  return prisma.cMSMenuItem.update({ where: { id }, data: body });
}

export async function deleteMenuItem(id: string) {
  return prisma.cMSMenuItem.delete({ where: { id } });
}

// ─── Public reads ─────────────────────────────────────────────────────────────

export async function publicGetPageByKey(pageKey: string) {
  return prisma.cMSPage.findFirst({
    where: { pageKey, status: "ACTIVE" },
    include: {
      sections: {
        where: { status: "ACTIVE" },
        orderBy: { sortOrder: "asc" },
        include: { blocks: { where: { status: "ACTIVE" }, orderBy: { sortOrder: "asc" } } },
      },
    },
  });
}

export async function publicGetPageBySlug(slug: string) {
  return prisma.cMSPage.findFirst({
    where: { slug, status: "ACTIVE" },
    include: {
      sections: {
        where: { status: "ACTIVE" },
        orderBy: { sortOrder: "asc" },
        include: { blocks: { where: { status: "ACTIVE" }, orderBy: { sortOrder: "asc" } } },
      },
    },
  });
}

export async function publicGetMenuByLocation(location: string) {
  return prisma.cMSMenu.findFirst({
    where: { location, status: "ACTIVE" },
    include: { items: { where: { status: "ACTIVE" }, orderBy: { sortOrder: "asc" } } },
  });
}

export async function publicGetFooter() {
  return prisma.cMSFooter.findFirst({ where: { status: "ACTIVE" } });
}
