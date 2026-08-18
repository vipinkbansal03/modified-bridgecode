import { prisma } from "../../config/database";
import { AppError } from "../../utils/apiResponse";

const GLOBAL_SETTINGS_KEY = "product_filters_config";
const CATEGORY_SETTINGS_PREFIX = "product_filters_config_category_";
const PRODUCT_VISIBILITY_PREFIX = "product_filter_visibility_";

export interface ProductFilterConfig {
  id: string;
  featuredOnly: boolean;
  categoryFilterEnabled: boolean;
  attributeFilters: AttributeFilterConfig[];
}

export interface AttributeFilterConfig {
  attributeId: string;
  attributeName: string;
  enabled: boolean;
  displayType: "DROPDOWN" | "X_GRID" | "Y_GRID";
  sortOrder: number;
  allowedValueIds: string[];
}

export interface CategoryFilterConfig {
  categoryId: string;
  categoryName: string;
  config: ProductFilterConfig;
}

async function cleanFiltersConfig(config: ProductFilterConfig): Promise<ProductFilterConfig> {
  const activeAttributes = await prisma.attribute.findMany({
    where: { status: "ACTIVE" },
    select: { id: true },
  });
  const activeIds = new Set(activeAttributes.map((a) => a.id));
  
  return {
    ...config,
    attributeFilters: (config.attributeFilters ?? []).filter((af) => activeIds.has(af.attributeId)),
  };
}

export async function getGlobalProductFiltersConfig(): Promise<ProductFilterConfig> {
  const setting = await prisma.setting.findUnique({
    where: { key: GLOBAL_SETTINGS_KEY },
  });

  let config: ProductFilterConfig;
  if (!setting || !setting.value) {
    config = getDefaultConfig();
  } else {
    try {
      config = JSON.parse(setting.value);
    } catch {
      config = getDefaultConfig();
    }
  }

  return cleanFiltersConfig(config);
}

export async function updateGlobalProductFiltersConfig(config: ProductFilterConfig): Promise<ProductFilterConfig> {
  await prisma.setting.upsert({
    where: { key: GLOBAL_SETTINGS_KEY },
    create: {
      key: GLOBAL_SETTINGS_KEY,
      value: JSON.stringify(config),
      group: "products",
      label: "Global Product Filters Configuration",
      type: "json",
      isEnabled: true,
    },
    update: {
      value: JSON.stringify(config),
      isEnabled: true,
    },
  });

  return config;
}

export async function getCategoryProductFiltersConfig(categoryId: string): Promise<ProductFilterConfig> {
  const setting = await prisma.setting.findUnique({
    where: { key: `${CATEGORY_SETTINGS_PREFIX}${categoryId}` },
  });

  if (!setting || !setting.value) {
    // Fall back to global config
    return getGlobalProductFiltersConfig();
  }

  try {
    const config = JSON.parse(setting.value);
    return cleanFiltersConfig(config);
  } catch {
    return getGlobalProductFiltersConfig();
  }
}

export async function updateCategoryProductFiltersConfig(categoryId: string, categoryName: string, config: ProductFilterConfig): Promise<ProductFilterConfig> {
  const key = `${CATEGORY_SETTINGS_PREFIX}${categoryId}`;
  await prisma.setting.upsert({
    where: { key },
    create: {
      key,
      value: JSON.stringify(config),
      group: "products",
      label: `Product Filters Configuration - ${categoryName}`,
      type: "json",
      isEnabled: true,
    },
    update: {
      value: JSON.stringify(config),
      isEnabled: true,
    },
  });

  return config;
}

export async function deleteCategoryProductFiltersConfig(categoryId: string): Promise<void> {
  const key = `${CATEGORY_SETTINGS_PREFIX}${categoryId}`;
  await prisma.setting.delete({ where: { key } }).catch(() => {});
}

export async function getAllCategoryProductFiltersConfigs(): Promise<CategoryFilterConfig[]> {
  const settings = await prisma.setting.findMany({
    where: {
      key: { startsWith: CATEGORY_SETTINGS_PREFIX },
    },
  });

  const activeAttributes = await prisma.attribute.findMany({
    where: { status: "ACTIVE" },
    select: { id: true },
  });
  const activeIds = new Set(activeAttributes.map((a) => a.id));

  return settings.map((s) => {
    let config: ProductFilterConfig;
    try {
      config = JSON.parse(s.value || "{}");
    } catch {
      config = getDefaultConfig();
    }

    config.attributeFilters = (config.attributeFilters ?? []).filter((af) => activeIds.has(af.attributeId));

    return {
      categoryId: s.key.replace(CATEGORY_SETTINGS_PREFIX, ""),
      categoryName: s.label?.replace("Product Filters Configuration - ", "") || "Unknown",
      config,
    };
  });
}

export async function getPublicProductFiltersConfig(categoryId?: string): Promise<ProductFilterConfig> {
  if (categoryId) {
    return getCategoryProductFiltersConfig(categoryId);
  }
  return getGlobalProductFiltersConfig();
}

export interface ProductFilterVisibilityItem {
  attributeId: string;
  attributeName: string;
  visibleOnStorefront: boolean;
}

export interface ProductFilterVisibility {
  productId: string;
  productTitle: string;
  items: ProductFilterVisibilityItem[];
}

export async function getProductFilterVisibility(productId: string): Promise<ProductFilterVisibility> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, title: true },
  });
  if (!product) throw new AppError("Product not found.", 404);

  const mappings = await prisma.productAttribute.findMany({
    where: { productId },
    orderBy: { createdAt: "asc" },
    include: { attribute: { select: { id: true, name: true } } },
  });

  const overrides = await getVisibilityOverrides(productId);

  return {
    productId: product.id,
    productTitle: product.title,
    items: mappings.map((m) => ({
      attributeId: m.attribute.id,
      attributeName: m.attribute.name,
      visibleOnStorefront: overrides[m.attribute.id] !== false,
    })),
  };
}

export async function setProductFilterVisibility(
  productId: string,
  items: Array<{ attributeId: string; visibleOnStorefront: boolean }>,
): Promise<ProductFilterVisibility> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true },
  });
  if (!product) throw new AppError("Product not found.", 404);

  const overrides: Record<string, boolean> = {};
  for (const it of items) {
    overrides[it.attributeId] = it.visibleOnStorefront;
  }

  const key = `${PRODUCT_VISIBILITY_PREFIX}${productId}`;
  await prisma.setting.upsert({
    where: { key },
    create: {
      key,
      value: JSON.stringify(overrides),
      group: "products",
      label: `Product Filter Visibility - ${productId}`,
      type: "json",
      isEnabled: true,
    },
    update: {
      value: JSON.stringify(overrides),
      isEnabled: true,
    },
  });

  return getProductFilterVisibility(productId);
}

async function getVisibilityOverrides(productId: string): Promise<Record<string, boolean>> {
  const key = `${PRODUCT_VISIBILITY_PREFIX}${productId}`;
  const setting = await prisma.setting.findUnique({ where: { key } });
  if (!setting || !setting.value) return {};
  try {
    const parsed = JSON.parse(setting.value);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function getDefaultConfig(): ProductFilterConfig {
  return {
    id: "default",
    featuredOnly: false,
    categoryFilterEnabled: true,
    attributeFilters: [],
  };
}