import { prisma } from "../../config/database";
import { AppError, getPagination } from "../../utils/apiResponse";
import { staticMessageDefaults, staticMessageKeys } from "../../constants/staticMessageKeys";

export type CoverageGapType = "product" | "category" | "static" | "cms";
export type CoveragePriority = "high" | "medium" | "low";
type CmsEntityType = "page" | "section" | "block" | "menuItem" | "footer";

const PRODUCT_FIELDS = ["title", "shortDescription", "description", "seoTitle", "seoDescription", "seoKeywords", "highlights", "technicalSpecs", "warranty", "primaryFeatures"] as const;
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
  seoKeywords: "SEO Keywords",
  highlights: "Highlights",
  technicalSpecs: "Technical Specifications",
  warranty: "Warranty",
  primaryFeatures: "Primary Features",
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
  priority: CoveragePriority;
  priorityLabel: string;
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
  totalFields: number;
  completedFields: number;
  completionPercentage: number;
};

type CoverageCollection = {
  gaps: CoverageGap[];
  totalFields: number;
};

type CoverageGapInput = Omit<CoverageGap, "priority" | "priorityLabel">;

const META_FIELDS = new Set(["seoTitle", "seoDescription", "ogTitle", "ogDescription"]);
const CUSTOMER_FACING_FIELDS = new Set([
  "title",
  "name",
  "label",
  "shortDescription",
  "description",
  "subtitle",
  "linkLabel",
  "address",
  "value",
]);

function hasValue(value: unknown): boolean {
  if (typeof value === "string") return Boolean(value.trim());
  if (Array.isArray(value)) return value.length > 0;
  return value != null;
}

function fieldLabel(field: string) {
  return FIELD_LABELS[field] ?? field;
}

function cmsTranslationKey(entityType: CmsEntityType, entityId: string, field: string) {
  return `cms.${entityType}.${entityId}.${field}`;
}

function getField(source: Record<string, unknown> | null | undefined, field: string) {
  return source?.[field];
}

function formatValue(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return JSON.stringify(value);
  if (value && typeof value === "object") return JSON.stringify(value);
  return "";
}

function collectMissingFields(
  source: Record<string, unknown>,
  translation: Record<string, unknown> | null | undefined,
  fields: readonly string[],
  getTranslationValue: (field: string) => unknown,
) {
  const missing: CoverageMissingField[] = [];

  for (const field of fields) {
    const englishValue = getField(source, field);
    if (!hasValue(englishValue)) continue;
    const translated = getField(translation, field) ?? getTranslationValue(field);
    if (!hasValue(translated)) {
      missing.push({
        field,
        fieldLabel: fieldLabel(field),
        englishValue: formatValue(englishValue),
      });
    }
  }

  return missing;
}

function countTranslatableFields(source: Record<string, unknown>, fields: readonly string[]) {
  return fields.reduce((count, field) => count + (hasValue(getField(source, field)) ? 1 : 0), 0);
}

function withPriority(gap: CoverageGapInput): CoverageGap {
  const metaOnly = gap.missingFields.length > 0 && gap.missingFields.every((field) => META_FIELDS.has(field.field));
  const hasCustomerFacingField = gap.missingFields.some((field) => CUSTOMER_FACING_FIELDS.has(field.field));

  if (gap.type === "static" || hasCustomerFacingField) {
    return { ...gap, priority: "high", priorityLabel: "Needs attention first" };
  }

  if (metaOnly) {
    return { ...gap, priority: "low", priorityLabel: "SEO / metadata" };
  }

  if (gap.type === "cms") {
    return { ...gap, priority: "medium", priorityLabel: "CMS content" };
  }

  return { ...gap, priority: "medium", priorityLabel: "Catalog content" };
}

function emptyBucket(): CoverageBucketSummary {
  return { gaps: 0, fields: 0, totalFields: 0, completedFields: 0, completionPercentage: 0 };
}

function finalizeBucket(bucket: CoverageBucketSummary) {
  bucket.completedFields = Math.max(0, bucket.totalFields - bucket.fields);
  bucket.completionPercentage = bucket.totalFields > 0 ? Math.round((bucket.completedFields / bucket.totalFields) * 100) : 100;
}

function summarize(collections: Record<CoverageGapType, CoverageCollection>): Record<CoverageGapType, CoverageBucketSummary> {
  const buckets: Record<CoverageGapType, CoverageBucketSummary> = {
    product: emptyBucket(),
    category: emptyBucket(),
    static: emptyBucket(),
    cms: emptyBucket(),
  };

  for (const type of Object.keys(collections) as CoverageGapType[]) {
    buckets[type].totalFields = collections[type].totalFields;

    for (const gap of collections[type].gaps) {
      buckets[type].gaps += 1;
      buckets[type].fields += gap.missingFields.length;
    }

    finalizeBucket(buckets[type]);
  }

  return buckets;
}

function gapMatchesSearch(gap: CoverageGap, search?: string) {
  const query = search?.trim().toLowerCase();
  if (!query) return true;

  const searchableText = [
    gap.type,
    gap.entityId,
    gap.entityLabel,
    gap.context ?? "",
    gap.cmsEntityType ?? "",
    ...gap.missingFields.flatMap((field) => [field.field, field.fieldLabel, field.englishValue]),
  ].join(" ").toLowerCase();

  return searchableText.includes(query);
}

function gapMatchesPriority(gap: CoverageGap, priority?: string) {
  if (!priority || priority === "all") return true;
  return gap.priority === priority;
}

async function collectProductGaps(languageId: string): Promise<CoverageCollection> {
  const products = await prisma.product.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      title: true,
      shortDescription: true,
      description: true,
      seoTitle: true,
      seoDescription: true,
      seoKeywords: true,
      highlights: true,
      technicalSpecs: true,
      warranty: true,
      primaryFeatures: true,
    },
    orderBy: { title: "asc" },
  });

  if (!products.length) return { gaps: [], totalFields: 0 };

  const translations = await prisma.productTranslation.findMany({
    where: { languageId, productId: { in: products.map((product) => product.id) } },
  });
  const translationMap = new Map(translations.map((row) => [row.productId, row]));
  const gaps: CoverageGap[] = [];
  let totalFields = 0;

  for (const product of products) {
    totalFields += countTranslatableFields(product, PRODUCT_FIELDS);
    const missingFields = collectMissingFields(product, translationMap.get(product.id) ?? null, PRODUCT_FIELDS, () => null);
    if (missingFields.length) {
      gaps.push(withPriority({
        type: "product",
        entityId: product.id,
        entityLabel: product.title,
        missingFields,
      }));
    }
  }

  return { gaps, totalFields };
}

async function collectCategoryGaps(languageId: string): Promise<CoverageCollection> {
  const categories = await prisma.category.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, description: true },
    orderBy: { name: "asc" },
  });

  if (!categories.length) return { gaps: [], totalFields: 0 };

  const translations = await prisma.categoryTranslation.findMany({
    where: { languageId, categoryId: { in: categories.map((category) => category.id) } },
  });
  const translationMap = new Map(translations.map((row) => [row.categoryId, row]));
  const gaps: CoverageGap[] = [];
  let totalFields = 0;

  for (const category of categories) {
    totalFields += countTranslatableFields(category, CATEGORY_FIELDS);
    const missingFields = collectMissingFields(category, translationMap.get(category.id) ?? null, CATEGORY_FIELDS, () => null);
    if (missingFields.length) {
      gaps.push(withPriority({
        type: "category",
        entityId: category.id,
        entityLabel: category.name,
        missingFields,
      }));
    }
  }

  return { gaps, totalFields };
}

async function collectStaticGaps(languageId: string): Promise<CoverageCollection> {
  const keywords = await prisma.translationKeyword.findMany({
    where: { languageId, key: { in: staticMessageKeys } },
    select: { key: true, value: true },
  });
  const keywordMap = new Map(keywords.map((row) => [row.key, row.value]));
  const gaps: CoverageGap[] = [];

  for (const key of staticMessageKeys) {
    if (hasValue(keywordMap.get(key))) continue;
    gaps.push(withPriority({
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
    }));
  }

  return { gaps, totalFields: staticMessageKeys.length };
}

async function collectCmsGaps(languageId: string): Promise<CoverageCollection> {
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
  let totalFields = 0;

  for (const page of pages) {
    totalFields += countTranslatableFields(page, CMS_TRANSLATABLE_FIELDS.page);
    const pageMissing = collectMissingFields(page, null, CMS_TRANSLATABLE_FIELDS.page, (field) =>
      getCmsValue("page", page.id, field),
    );
    if (pageMissing.length) {
      gaps.push(withPriority({
        type: "cms",
        entityId: page.id,
        entityLabel: page.title,
        context: "Page",
        cmsEntityType: "page",
        missingFields: pageMissing,
      }));
    }

    for (const section of page.sections) {
      totalFields += countTranslatableFields(section, CMS_TRANSLATABLE_FIELDS.section);
      const sectionMissing = collectMissingFields(section, null, CMS_TRANSLATABLE_FIELDS.section, (field) =>
        getCmsValue("section", section.id, field),
      );
      if (sectionMissing.length) {
        gaps.push(withPriority({
          type: "cms",
          entityId: section.id,
          entityLabel: section.title || section.sectionKey,
          context: `${page.title} › ${section.sectionKey}`,
          cmsEntityType: "section",
          cmsPageId: page.id,
          missingFields: sectionMissing,
        }));
      }

      for (const block of section.blocks) {
        totalFields += countTranslatableFields(block, CMS_TRANSLATABLE_FIELDS.block);
        const blockMissing = collectMissingFields(block, null, CMS_TRANSLATABLE_FIELDS.block, (field) =>
          getCmsValue("block", block.id, field),
        );
        if (blockMissing.length) {
          gaps.push(withPriority({
            type: "cms",
            entityId: block.id,
            entityLabel: block.title || block.blockType,
            context: `${page.title} › ${section.sectionKey} › ${block.blockType}`,
            cmsEntityType: "block",
            cmsPageId: page.id,
            missingFields: blockMissing,
          }));
        }
      }
    }
  }

  for (const menu of menus) {
    for (const item of menu.items) {
      totalFields += countTranslatableFields(item, CMS_TRANSLATABLE_FIELDS.menuItem);
      const itemMissing = collectMissingFields(item, null, CMS_TRANSLATABLE_FIELDS.menuItem, (field) =>
        getCmsValue("menuItem", item.id, field),
      );
      if (itemMissing.length) {
        gaps.push(withPriority({
          type: "cms",
          entityId: item.id,
          entityLabel: item.label,
          context: `${menu.name} menu`,
          cmsEntityType: "menuItem",
          missingFields: itemMissing,
        }));
      }
    }
  }

  if (footer) {
    totalFields += countTranslatableFields(footer, CMS_TRANSLATABLE_FIELDS.footer);
    const footerMissing = collectMissingFields(footer, null, CMS_TRANSLATABLE_FIELDS.footer, (field) =>
      getCmsValue("footer", footer.id, field),
    );
    if (footerMissing.length) {
      gaps.push(withPriority({
        type: "cms",
        entityId: footer.id,
        entityLabel: footer.title || "Footer",
        context: "Footer",
        cmsEntityType: "footer",
        missingFields: footerMissing,
      }));
    }
  }

  return { gaps, totalFields };
}

function gapMatchesSection(gap: CoverageGap, section?: string) {
  if (!section || section === "all") return true;

  if (gap.type === "static") {
    const key = gap.entityId.toLowerCase();
    if (section === "nav") return key.startsWith("ui.nav") || key.startsWith("ui.header") || key.startsWith("ui.menu");
    if (section === "product") return key.startsWith("ui.product") || key.startsWith("ui.catalog") || key.startsWith("ui.price") || key.startsWith("ui.pdp") || key.startsWith("ui.filter");
    if (section === "cart") return key.startsWith("ui.cart") || key.startsWith("ui.checkout") || key.startsWith("ui.quote") || key.startsWith("ui.order");
    if (section === "account") return key.startsWith("ui.account") || key.startsWith("ui.auth") || key.startsWith("ui.login") || key.startsWith("ui.user") || key.startsWith("ui.profile");
    if (section === "footer") return key.startsWith("ui.footer") || key.startsWith("ui.legal") || key.startsWith("ui.terms") || key.startsWith("ui.cookie");
    if (section === "general") return !key.startsWith("ui.nav") && !key.startsWith("ui.header") && !key.startsWith("ui.product") && !key.startsWith("ui.cart") && !key.startsWith("ui.account") && !key.startsWith("ui.footer");
  }

  if (gap.type === "cms") {
    if (section === "page") return gap.cmsEntityType === "page";
    if (section === "section") return gap.cmsEntityType === "section" || gap.cmsEntityType === "block";
    if (section === "menu") return gap.cmsEntityType === "menuItem";
    if (section === "footer") return gap.cmsEntityType === "footer";
  }

  if (gap.type === "product") {
    if (section === "info") return gap.missingFields.some((f) => ["title", "shortDescription", "description"].includes(f.field));
    if (section === "specs") return gap.missingFields.some((f) => ["technicalSpecs", "primaryFeatures", "highlights", "warranty"].includes(f.field));
    if (section === "seo") return gap.missingFields.some((f) => ["seoTitle", "seoDescription", "seoKeywords"].includes(f.field));
  }

  if (gap.type === "category") {
    if (section === "names") return gap.missingFields.some((f) => f.field === "name");
    if (section === "descriptions") return gap.missingFields.some((f) => f.field === "description");
  }

  return true;
}

export async function getTranslationCoverage(
  languageId: string,
  query: { type?: string; priority?: string; page?: string; limit?: string; search?: string; section?: string },
) {
  if (!languageId || languageId === "undefined" || languageId === "null") {
    throw new AppError("languageId is required.", 400);
  }

  const language = await prisma.language.findUnique({
    where: { id: languageId },
    select: { id: true, name: true, code: true, isDefault: true, isEnabled: true },
  });

  if (!language) throw new AppError("Language not found.", 404);
  if (language.isDefault) throw new AppError("Coverage is only available for non-default languages.", 400);
  if (!language.isEnabled) throw new AppError("Language is disabled.", 400);

  const filterType = query.type as CoverageGapType | "all" | undefined;
  const priorityFilter = query.priority as CoveragePriority | "all" | undefined;
  const sectionFilter = query.section;
  const { page, limit, skip } = getPagination(query);

  if (filterType && filterType !== "all" && !["product", "category", "static", "cms"].includes(filterType)) {
    throw new AppError("Invalid coverage type.", 400);
  }

  if (priorityFilter && priorityFilter !== "all" && !["high", "medium", "low"].includes(priorityFilter)) {
    throw new AppError("Invalid coverage priority.", 400);
  }

  const [productCoverage, categoryCoverage, staticCoverage, cmsCoverage] = await Promise.all([
    collectProductGaps(languageId),
    collectCategoryGaps(languageId),
    collectStaticGaps(languageId),
    collectCmsGaps(languageId),
  ]);

  const collections: Record<CoverageGapType, CoverageCollection> = {
    product: productCoverage,
    category: categoryCoverage,
    static: staticCoverage,
    cms: cmsCoverage,
  };

  const allGaps = [
    ...productCoverage.gaps,
    ...categoryCoverage.gaps,
    ...staticCoverage.gaps,
    ...cmsCoverage.gaps,
  ];
  const summary = summarize(collections);

  const filteredGaps =
    !filterType || filterType === "all"
      ? allGaps
      : allGaps.filter((gap) => gap.type === filterType);

  const sectionGaps = filteredGaps.filter((gap) => gapMatchesSection(gap, sectionFilter));
  const priorityGaps = sectionGaps.filter((gap) => gapMatchesPriority(gap, priorityFilter));
  const searchedGaps = priorityGaps.filter((gap) => gapMatchesSearch(gap, query.search));

  const total = searchedGaps.length;
  const data = searchedGaps.slice(skip, skip + limit);

  return {
    language,
    summary,
    gaps: { data, total, page, limit, skip, totalPages: Math.ceil(total / limit) },
  };
}
