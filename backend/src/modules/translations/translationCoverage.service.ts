import { prisma } from "../../config/database";
import { AppError, getPagination } from "../../utils/apiResponse";
import { staticMessageDefaults, staticMessageKeys } from "../../constants/staticMessageKeys";

export type CoverageGapType = "product" | "category" | "static" | "cms";
type CmsEntityType = "page" | "section" | "block" | "menuItem" | "footer";

const PRODUCT_FIELDS = ["title", "shortDescription", "description", "seoTitle", "seoDescription"] as const;
const CATEGORY_FIELDS = ["name", "description"] as const;

const CMS_TRANSLATABLE_FIELDS: Record<CmsEntityType, string[]> = {
  page: ["title", "seoTitle", "seoDescription", "ogTitle", "ogDescription"],
  section: ["title", "subtitle", "description"],
  block: ["title", "subtitle", "description", "linkLabel"],
  menuItem: ["label"],
  footer: ["title", "description", "address"],
};

const FIELD_LABELS: Record<string, string> = {
  title: "Title",
  shortDescription: "Short Description",
  description: "Description",
  seoTitle: "SEO Title",
  seoDescription: "SEO Description",
  name: "Name",
  subtitle: "Subtitle",
  linkLabel: "Link Label",
  label: "Label",
  address: "Address",
  ogTitle: "OG Title",
  ogDescription: "OG Description",
  value: "Translation",
};

export type CoverageMissingField = {
  field: string;
  fieldLabel: string;
  englishValue: string;
};

export type CoverageGap = {
  type: CoverageGapType;
  entityId: string;
  entityLabel: string;
  context?: string;
  cmsEntityType?: CmsEntityType;
  cmsPageId?: string;
  missingFields: CoverageMissingField[];
};

export type CoverageBucketSummary = {
  gaps: number;
  fields: number;
};

function hasValue(value: unknown): value is string {
  return typeof value === "string" && Boolean(value.trim());
}

function fieldLabel(field: string) {
  return FIELD_LABELS[field] ?? field;
}

function cmsTranslationKey(entityType: CmsEntityType, entityId: string, field: string) {
  return `cms.${entityType}.${entityId}.${field}`;
}

function getStringField(source: Record<string, unknown> | null | undefined, field: string) {
  const value = source?.[field];
  return typeof value === "string" ? value : null;
}

function collectMissingFields(
  source: Record<string, unknown>,
  translation: Record<string, unknown> | null | undefined,
  fields: readonly string[],
  getTranslationValue: (field: string) => unknown,
) {
  const missing: CoverageMissingField[] = [];

  for (const field of fields) {
    const englishValue = getStringField(source, field);
    if (!hasValue(englishValue)) continue;
    const translated = getStringField(translation, field) ?? getTranslationValue(field);
    if (!hasValue(translated)) {
      missing.push({
        field,
        fieldLabel: fieldLabel(field),
        englishValue: englishValue.trim(),
      });
    }
  }

  return missing;
}

function summarize(gaps: CoverageGap[]): Record<CoverageGapType, CoverageBucketSummary> {
  const buckets: Record<CoverageGapType, CoverageBucketSummary> = {
    product: { gaps: 0, fields: 0 },
    category: { gaps: 0, fields: 0 },
    static: { gaps: 0, fields: 0 },
    cms: { gaps: 0, fields: 0 },
  };

  for (const gap of gaps) {
    buckets[gap.type].gaps += 1;
    buckets[gap.type].fields += gap.missingFields.length;
  }

  return buckets;
}

async function collectProductGaps(languageId: string): Promise<CoverageGap[]> {
  const products = await prisma.product.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      title: true,
      shortDescription: true,
      description: true,
      seoTitle: true,
      seoDescription: true,
    },
    orderBy: { title: "asc" },
  });

  if (!products.length) return [];

  const translations = await prisma.productTranslation.findMany({
    where: { languageId, productId: { in: products.map((product) => product.id) } },
  });
  const translationMap = new Map(translations.map((row) => [row.productId, row]));
  const gaps: CoverageGap[] = [];

  for (const product of products) {
    const missingFields = collectMissingFields(product, translationMap.get(product.id) ?? null, PRODUCT_FIELDS, () => null);
    if (missingFields.length) {
      gaps.push({
        type: "product",
        entityId: product.id,
        entityLabel: product.title,
        missingFields,
      });
    }
  }

  return gaps;
}

async function collectCategoryGaps(languageId: string): Promise<CoverageGap[]> {
  const categories = await prisma.category.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, description: true },
    orderBy: { name: "asc" },
  });

  if (!categories.length) return [];

  const translations = await prisma.categoryTranslation.findMany({
    where: { languageId, categoryId: { in: categories.map((category) => category.id) } },
  });
  const translationMap = new Map(translations.map((row) => [row.categoryId, row]));
  const gaps: CoverageGap[] = [];

  for (const category of categories) {
    const missingFields = collectMissingFields(category, translationMap.get(category.id) ?? null, CATEGORY_FIELDS, () => null);
    if (missingFields.length) {
      gaps.push({
        type: "category",
        entityId: category.id,
        entityLabel: category.name,
        missingFields,
      });
    }
  }

  return gaps;
}

async function collectStaticGaps(languageId: string): Promise<CoverageGap[]> {
  const keywords = await prisma.translationKeyword.findMany({
    where: { languageId, key: { in: staticMessageKeys } },
    select: { key: true, value: true },
  });
  const keywordMap = new Map(keywords.map((row) => [row.key, row.value]));
  const gaps: CoverageGap[] = [];

  for (const key of staticMessageKeys) {
    if (hasValue(keywordMap.get(key))) continue;
    gaps.push({
      type: "static",
      entityId: key,
      entityLabel: key,
      missingFields: [
        {
          field: "value",
          fieldLabel: fieldLabel("value"),
          englishValue: staticMessageDefaults[key] ?? key,
        },
      ],
    });
  }

  return gaps;
}

async function collectCmsGaps(languageId: string): Promise<CoverageGap[]> {
  const [pages, menus, footer, cmsKeywords] = await Promise.all([
    prisma.cMSPage.findMany({
      include: {
        sections: {
          orderBy: { sortOrder: "asc" },
          include: { blocks: { orderBy: { sortOrder: "asc" } } },
        },
      },
      orderBy: { title: "asc" },
    }),
    prisma.cMSMenu.findMany({
      include: { items: { orderBy: { sortOrder: "asc" } } },
      orderBy: { name: "asc" },
    }),
    prisma.cMSFooter.findFirst(),
    prisma.translationKeyword.findMany({
      where: { languageId, key: { startsWith: "cms." } },
      select: { key: true, value: true },
    }),
  ]);

  const cmsValueMap = new Map(cmsKeywords.map((row) => [row.key, row.value]));
  const getCmsValue = (entityType: CmsEntityType, entityId: string, field: string) =>
    cmsValueMap.get(cmsTranslationKey(entityType, entityId, field));

  const gaps: CoverageGap[] = [];

  for (const page of pages) {
    const pageMissing = collectMissingFields(page, null, CMS_TRANSLATABLE_FIELDS.page, (field) =>
      getCmsValue("page", page.id, field),
    );
    if (pageMissing.length) {
      gaps.push({
        type: "cms",
        entityId: page.id,
        entityLabel: page.title,
        context: "Page",
        cmsEntityType: "page",
        missingFields: pageMissing,
      });
    }

    for (const section of page.sections) {
      const sectionMissing = collectMissingFields(section, null, CMS_TRANSLATABLE_FIELDS.section, (field) =>
        getCmsValue("section", section.id, field),
      );
      if (sectionMissing.length) {
        gaps.push({
          type: "cms",
          entityId: section.id,
          entityLabel: section.title || section.sectionKey,
          context: `${page.title} › ${section.sectionKey}`,
          cmsEntityType: "section",
          cmsPageId: page.id,
          missingFields: sectionMissing,
        });
      }

      for (const block of section.blocks) {
        const blockMissing = collectMissingFields(block, null, CMS_TRANSLATABLE_FIELDS.block, (field) =>
          getCmsValue("block", block.id, field),
        );
        if (blockMissing.length) {
          gaps.push({
            type: "cms",
            entityId: block.id,
            entityLabel: block.title || block.blockType,
            context: `${page.title} › ${section.sectionKey} › ${block.blockType}`,
            cmsEntityType: "block",
            cmsPageId: page.id,
            missingFields: blockMissing,
          });
        }
      }
    }
  }

  for (const menu of menus) {
    for (const item of menu.items) {
      const itemMissing = collectMissingFields(item, null, CMS_TRANSLATABLE_FIELDS.menuItem, (field) =>
        getCmsValue("menuItem", item.id, field),
      );
      if (itemMissing.length) {
        gaps.push({
          type: "cms",
          entityId: item.id,
          entityLabel: item.label,
          context: `${menu.name} menu`,
          cmsEntityType: "menuItem",
          missingFields: itemMissing,
        });
      }
    }
  }

  if (footer) {
    const footerMissing = collectMissingFields(footer, null, CMS_TRANSLATABLE_FIELDS.footer, (field) =>
      getCmsValue("footer", footer.id, field),
    );
    if (footerMissing.length) {
      gaps.push({
        type: "cms",
        entityId: footer.id,
        entityLabel: footer.title || "Footer",
        context: "Footer",
        cmsEntityType: "footer",
        missingFields: footerMissing,
      });
    }
  }

  return gaps;
}

export async function getTranslationCoverage(
  languageId: string,
  query: { type?: string; page?: string; limit?: string },
) {
  if (!languageId) throw new AppError("languageId is required.", 400);

  const language = await prisma.language.findUnique({
    where: { id: languageId },
    select: { id: true, name: true, code: true, isDefault: true, isEnabled: true },
  });

  if (!language) throw new AppError("Language not found.", 404);
  if (language.isDefault) throw new AppError("Coverage is only available for non-default languages.", 400);
  if (!language.isEnabled) throw new AppError("Language is disabled.", 400);

  const filterType = query.type as CoverageGapType | "all" | undefined;
  const { page, limit, skip } = getPagination(query);

  const [productGaps, categoryGaps, staticGaps, cmsGaps] = await Promise.all([
    collectProductGaps(languageId),
    collectCategoryGaps(languageId),
    collectStaticGaps(languageId),
    collectCmsGaps(languageId),
  ]);

  const allGaps = [...productGaps, ...categoryGaps, ...staticGaps, ...cmsGaps];
  const summary = summarize(allGaps);

  const filteredGaps =
    !filterType || filterType === "all"
      ? allGaps
      : allGaps.filter((gap) => gap.type === filterType);

  if (filterType && filterType !== "all" && !["product", "category", "static", "cms"].includes(filterType)) {
    throw new AppError("Invalid coverage type.", 400);
  }

  const total = filteredGaps.length;
  const data = filteredGaps.slice(skip, skip + limit);

  return {
    language,
    summary,
    gaps: { data, total, page, limit },
  };
}
