import { prisma } from "../../config/database";
import { AppError, getPagination } from "../../utils/apiResponse";

// ─── Types ────────────────────────────────────────────────────────────────────

type PageBody = {
  title: string;
  slug: string;
  pageKey: string;
  status?: string;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
  robotsTag?: string;
  canonicalUrl?: string;
  favicon?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: string;
  faqSchemaJson?: object;
};
type SectionBody = { sectionKey: string; title?: string; subtitle?: string; description?: string; layoutType?: string; sortOrder?: number; status?: string; settingsJson?: object };
type BlockBody = { blockType: string; title?: string; subtitle?: string; description?: string; image?: string; icon?: string; linkLabel?: string; linkUrl?: string; sortOrder?: number; status?: string; dataJson?: object };
type FooterBody = { title?: string; description?: string; logo?: string; address?: string; email?: string; phone?: string; socialLinksJson?: object; newsletterEnabled?: boolean; status?: string };
type MenuBody = { name: string; location: string; status?: string };
type MenuItemBody = { parentId?: string; label: string; url: string; sortOrder?: number; openInNewTab?: boolean; status?: string };
type CmsEntityType = "page" | "section" | "block" | "menuItem" | "footer";

const cmsTranslatableFields: Record<CmsEntityType, string[]> = {
  page: ["title", "seoTitle", "seoDescription", "ogTitle", "ogDescription"],
  section: ["title", "subtitle", "description"],
  block: ["title", "subtitle", "description", "linkLabel"],
  menuItem: ["label"],
  footer: ["title", "description", "address"],
};

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
  return attachPageCmsTranslations(p);
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
  const footer = await prisma.cMSFooter.findFirst({ orderBy: { createdAt: "asc" } });
  if (!footer) return null;
  return attachEntityCmsTranslations("footer", footer);
}

export async function upsertFooter(body: FooterBody) {
  const existing = await prisma.cMSFooter.findFirst();
  if (existing) return prisma.cMSFooter.update({ where: { id: existing.id }, data: body });
  return prisma.cMSFooter.create({ data: body });
}

// ─── Menus ────────────────────────────────────────────────────────────────────

export async function listMenus() {
  const menus = await prisma.cMSMenu.findMany({ include: { items: { orderBy: { sortOrder: "asc" } } } });
  return Promise.all(menus.map(attachMenuCmsTranslations));
}

export async function createMenu(body: MenuBody) {
  return prisma.cMSMenu.create({ data: body, include: { items: true } });
}

export async function getMenu(id: string) {
  const m = await prisma.cMSMenu.findUnique({ where: { id }, include: { items: { orderBy: { sortOrder: "asc" } } } });
  if (!m) throw new AppError("Menu not found.", 404);
  return attachMenuCmsTranslations(m);
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

export async function upsertCmsTranslation(entityType: CmsEntityType, entityId: string, languageId: string, data: Record<string, string | null | undefined>) {
  const allowedFields = cmsTranslatableFields[entityType];
  if (!allowedFields) throw new AppError("Unsupported CMS translation entity.", 400);

  const language = await prisma.language.findUnique({ where: { id: languageId }, select: { id: true } });
  if (!language) throw new AppError("Language not found.", 404);

  const entries = Object.entries(data).filter(([field]) => allowedFields.includes(field));
  if (!entries.length) throw new AppError("No translatable fields supplied.", 400);

  return Promise.all(entries.map(([field, value]) =>
    prisma.translationKeyword.upsert({
      where: { key_languageId: { key: cmsTranslationKey(entityType, entityId, field), languageId } },
      create: { key: cmsTranslationKey(entityType, entityId, field), languageId, value: value ?? "" },
      update: { value: value ?? "" },
      include: { language: true },
    })
  ));
}

// ─── Public reads ─────────────────────────────────────────────────────────────

export async function publicGetPageByKey(pageKey: string, languageCode?: string) {
  const page = await prisma.cMSPage.findFirst({
    where: { pageKey, status: "ACTIVE" },
    include: {
      sections: {
        where: { status: "ACTIVE" },
        orderBy: { sortOrder: "asc" },
        include: { blocks: { where: { status: "ACTIVE" }, orderBy: { sortOrder: "asc" } } },
      },
    },
  });
  return applyPageCmsTranslation(page, languageCode);
}

export async function publicGetPageBySlug(slug: string, languageCode?: string) {
  const page = await prisma.cMSPage.findFirst({
    where: { slug, status: "ACTIVE" },
    include: {
      sections: {
        where: { status: "ACTIVE" },
        orderBy: { sortOrder: "asc" },
        include: { blocks: { where: { status: "ACTIVE" }, orderBy: { sortOrder: "asc" } } },
      },
    },
  });
  return applyPageCmsTranslation(page, languageCode);
}

export async function publicGetMenuByLocation(location: string, languageCode?: string) {
  const menu = await prisma.cMSMenu.findFirst({
    where: { location, status: "ACTIVE" },
    include: { items: { where: { status: "ACTIVE" }, orderBy: { sortOrder: "asc" } } },
  });
  return applyMenuCmsTranslation(menu, languageCode);
}

export async function publicGetFooter(languageCode?: string) {
  const footer = await prisma.cMSFooter.findFirst({ where: { status: "ACTIVE" } });
  return applyEntityCmsTranslation("footer", footer, languageCode);
}

function cmsTranslationKey(entityType: CmsEntityType, entityId: string, field: string) {
  return `cms.${entityType}.${entityId}.${field}`;
}

function parseCmsTranslationKey(key: string) {
  const [, entityType, entityId, ...fieldParts] = key.split(".");
  return { entityType, entityId, field: fieldParts.join(".") };
}

async function getCmsTranslations(entityType: CmsEntityType, ids: string[]) {
  if (!ids.length) return new Map<string, Record<string, Array<{ languageId: string; value: string; language: { id: string; name: string; code: string } }>>>();

  const rows = await prisma.translationKeyword.findMany({
    where: { OR: ids.map((id) => ({ key: { startsWith: `cms.${entityType}.${id}.` } })) },
    include: { language: true },
  });

  const map = new Map<string, Record<string, Array<{ languageId: string; value: string; language: { id: string; name: string; code: string } }>>>();
  for (const row of rows) {
    const parsed = parseCmsTranslationKey(row.key);
    if (parsed.entityType !== entityType || !parsed.field) continue;
    const entityTranslations = map.get(parsed.entityId) ?? {};
    entityTranslations[parsed.field] = [
      ...(entityTranslations[parsed.field] ?? []),
      { languageId: row.languageId, value: row.value, language: { id: row.language.id, name: row.language.name, code: row.language.code } },
    ];
    map.set(parsed.entityId, entityTranslations);
  }
  return map;
}

async function attachEntityCmsTranslations<T extends { id: string }>(entityType: CmsEntityType, entity: T) {
  const translations = await getCmsTranslations(entityType, [entity.id]);
  return { ...entity, translations: translations.get(entity.id) ?? {} };
}

async function attachPageCmsTranslations<T extends { id: string; sections: Array<{ id: string; blocks: Array<{ id: string }> }> }>(page: T) {
  const [pageTranslations, sectionTranslations, blockTranslations] = await Promise.all([
    getCmsTranslations("page", [page.id]),
    getCmsTranslations("section", page.sections.map((section) => section.id)),
    getCmsTranslations("block", page.sections.flatMap((section) => section.blocks.map((block) => block.id))),
  ]);

  return {
    ...page,
    translations: pageTranslations.get(page.id) ?? {},
    sections: page.sections.map((section) => ({
      ...section,
      translations: sectionTranslations.get(section.id) ?? {},
      blocks: section.blocks.map((block) => ({ ...block, translations: blockTranslations.get(block.id) ?? {} })),
    })),
  };
}

async function attachMenuCmsTranslations<T extends { items: Array<{ id: string }> }>(menu: T) {
  const itemTranslations = await getCmsTranslations("menuItem", menu.items.map((item) => item.id));
  return {
    ...menu,
    items: menu.items.map((item) => ({ ...item, translations: itemTranslations.get(item.id) ?? {} })),
  };
}

async function getLanguage(languageCode?: string) {
  if (!languageCode) return null;
  return prisma.language.findFirst({ where: { code: languageCode, isEnabled: true }, select: { id: true } });
}

async function getCmsTranslationValues(entityType: CmsEntityType, ids: string[], languageCode?: string) {
  const language = await getLanguage(languageCode);
  if (!language || !ids.length) return new Map<string, Record<string, string>>();

  const rows = await prisma.translationKeyword.findMany({
    where: {
      languageId: language.id,
      OR: ids.map((id) => ({ key: { startsWith: `cms.${entityType}.${id}.` } })),
    },
  });

  const map = new Map<string, Record<string, string>>();
  for (const row of rows) {
    const parsed = parseCmsTranslationKey(row.key);
    if (parsed.entityType !== entityType || !parsed.field || !row.value) continue;
    map.set(parsed.entityId, { ...(map.get(parsed.entityId) ?? {}), [parsed.field]: row.value });
  }
  return map;
}

function applyFields<T extends { id: string }>(entity: T, values?: Record<string, string>) {
  return values ? { ...entity, ...values } : entity;
}

async function applyEntityCmsTranslation<T extends { id: string } | null>(entityType: CmsEntityType, entity: T, languageCode?: string) {
  if (!entity) return entity;
  const values = await getCmsTranslationValues(entityType, [entity.id], languageCode);
  return applyFields(entity, values.get(entity.id)) as T;
}

async function applyPageCmsTranslation<T extends { id: string; sections: Array<{ id: string; blocks: Array<{ id: string }> }> } | null>(page: T, languageCode?: string) {
  if (!page) return page;
  const [pageTranslations, sectionTranslations, blockTranslations] = await Promise.all([
    getCmsTranslationValues("page", [page.id], languageCode),
    getCmsTranslationValues("section", page.sections.map((section) => section.id), languageCode),
    getCmsTranslationValues("block", page.sections.flatMap((section) => section.blocks.map((block) => block.id)), languageCode),
  ]);

  return {
    ...applyFields(page, pageTranslations.get(page.id)),
    sections: page.sections.map((section) => ({
      ...applyFields(section, sectionTranslations.get(section.id)),
      blocks: section.blocks.map((block) => applyFields(block, blockTranslations.get(block.id))),
    })),
  } as T;
}

async function applyMenuCmsTranslation<T extends { items: Array<{ id: string }> } | null>(menu: T, languageCode?: string) {
  if (!menu) return menu;
  const itemTranslations = await getCmsTranslationValues("menuItem", menu.items.map((item) => item.id), languageCode);
  return {
    ...menu,
    items: menu.items.map((item) => applyFields(item, itemTranslations.get(item.id))),
  } as T;
}
