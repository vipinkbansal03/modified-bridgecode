import { AttributeRole, AttributeStatus, GridRole, Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { AppError, slugify } from "../../utils/apiResponse";
import { readSpreadsheetRows, writeSpreadsheetBuffer } from "../../utils/spreadsheet";

type ValueInput = {
  value?: string;
  slug?: string;
  image?: string | null;
  note?: string | null;
  priceAdjustment?: number;
  gridRole?: "ROW" | "COLUMN" | null;
  countryId?: string | null;
  moq?: number | null;
  tierPrice?: number | null;
  dealerPrice?: number | null;
  validationRole?: AttributeRole;
  status?: string;
  sortOrder?: number;
};

const valueInclude = {
  country: { select: { id: true, name: true, code: true } },
} satisfies Prisma.AttributeValueInclude;

function decimalOrNull(value: number | null | undefined) {
  if (value == null) return null;
  return new Prisma.Decimal(value);
}

export function validateValueForRole(role: AttributeRole, data: ValueInput) {
  const gridRole = data.gridRole ?? null;
  const countryId = data.countryId ?? null;
  const moq = data.moq ?? null;
  const tierPrice = data.tierPrice ?? null;
  const dealerPrice = data.dealerPrice ?? null;

  if (gridRole && gridRole !== "ROW" && gridRole !== "COLUMN") {
    throw new AppError("Grid role must be ROW or COLUMN when provided.", 400);
  }

  if (moq != null && moq < 0) {
    throw new AppError("MOQ must be zero or greater.", 400);
  }

  if (tierPrice != null && tierPrice < 0) {
    throw new AppError("Tier price must be zero or greater.", 400);
  }

  if (dealerPrice != null && dealerPrice < 0) {
    throw new AppError("Dealer price must be zero or greater.", 400);
  }

  if (role === "DROPDOWN" || role === "X_GRID" || role === "Y_GRID") {
    return;
  }
}

function getValidationRole(attributeRole: AttributeRole, data: ValueInput) {
  return data.validationRole ?? attributeRole;
}

async function getAttributeOrThrow(id: string) {
  const attribute = await prisma.attribute.findUnique({ where: { id } });
  if (!attribute) throw new AppError("Attribute not found.", 404);
  return attribute;
}

async function assertUniqueAttributeName(name: string, excludeId?: string) {
  const existing = await prisma.attribute.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
  });
  if (existing) throw new AppError("An attribute with this name already exists.", 409);
}

async function assertUniqueValueSlug(attributeId: string, slug: string, excludeId?: string) {
  const existing = await prisma.attributeValue.findFirst({
    where: {
      attributeId,
      slug,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
  });
  if (existing?.status === "ACTIVE") {
    throw new AppError("This value already exists for the selected attribute.", 409);
  }
  return existing;
}

async function assertUniqueCountryPerAttribute(
  attributeId: string,
  countryId: string,
  excludeId?: string,
) {
  const existing = await prisma.attributeValue.findFirst({
    where: {
      attributeId,
      countryId,
      status: "ACTIVE",
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
  });
  if (existing) {
    throw new AppError("This country is already used for this attribute.", 409);
  }
}

async function validateRoleChange(attributeId: string, newRole: AttributeRole) {
  const values = await prisma.attributeValue.findMany({
    where: { attributeId, status: "ACTIVE" },
  });
  const incompatible = values.filter((value) => {
    try {
      validateValueForRole(newRole, {
        gridRole: value.gridRole,
        countryId: value.countryId,
        moq: value.moq,
        tierPrice: value.tierPrice != null ? Number(value.tierPrice) : null,
        dealerPrice: value.dealerPrice != null ? Number(value.dealerPrice) : null,
      });
      return false;
    } catch {
      return true;
    }
  });
  if (incompatible.length > 0) {
    throw new AppError(
      `Cannot change role to ${newRole}: ${incompatible.length} existing value(s) are incompatible. Update or remove them first.`,
      400,
    );
  }
}

async function getFilterConfigAttributeIds(): Promise<Set<string>> {
  const settings = await prisma.setting.findMany({
    where: {
      OR: [
        { key: "product_filters_config" },
        { key: { startsWith: "product_filters_config_category_" } },
      ],
    },
    select: { value: true },
  });

  const ids = new Set<string>();
  for (const s of settings) {
    if (!s.value) continue;
    try {
      const parsed = JSON.parse(s.value);
      if (Array.isArray(parsed.attributeFilters)) {
        for (const af of parsed.attributeFilters) {
          if (af.attributeId) ids.add(String(af.attributeId));
        }
      }
    } catch {
      // ignore JSON parse error
    }
  }
  return ids;
}

export const listAttributes = async (query?: { deleted?: string }) => {
  const isDeleted = query?.deleted === "true";
  const attributes = await prisma.attribute.findMany({
    where: isDeleted ? { deletedAt: { not: null } } : { deletedAt: null },
    orderBy: { sortOrder: "asc" },
    include: {
      values: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, value: true, slug: true, status: true, sortOrder: true },
      },
      _count: { select: { values: true } },
    },
  });

  if (attributes.length === 0) return attributes;

  const attrIds = attributes.map((a) => a.id);

  const [productAttrs, variantAttrs, valueSelections, filterAttrIds] = await Promise.all([
    prisma.productAttribute.groupBy({
      by: ["attributeId"],
      where: { attributeId: { in: attrIds } },
      _count: { _all: true },
    }),
    prisma.productVariantAttributeValue.groupBy({
      by: ["attributeId"],
      where: { attributeId: { in: attrIds } },
      _count: { _all: true },
    }),
    prisma.productAttributeValueSelection.findMany({
      where: { attributeValue: { attributeId: { in: attrIds } } },
      select: { attributeValue: { select: { attributeId: true } } },
    }),
    getFilterConfigAttributeIds(),
  ]);

  const productCountMap = new Map(productAttrs.map((p) => [p.attributeId, p._count._all]));
  const variantCountMap = new Map(variantAttrs.map((v) => [v.attributeId, v._count._all]));
  const selectionCountMap = new Map<string, number>();
  for (const sel of valueSelections) {
    const aId = sel.attributeValue?.attributeId;
    if (aId) {
      selectionCountMap.set(aId, (selectionCountMap.get(aId) || 0) + 1);
    }
  }

  return attributes.map((attr) => {
    const productsCount = productCountMap.get(attr.id) || 0;
    const variantsCount = variantCountMap.get(attr.id) || 0;
    const selectionsCount = selectionCountMap.get(attr.id) || 0;
    const isConfiguredInFilter = filterAttrIds.has(attr.id);

    let canPermanentDelete = true;
    let permanentDeleteBlockReason: string | null = null;

    if (productsCount > 0) {
      canPermanentDelete = false;
      permanentDeleteBlockReason = `Cannot permanently delete: Referenced by ${productsCount} product assignment(s) across active and archived products.`;
    } else if (variantsCount > 0) {
      canPermanentDelete = false;
      permanentDeleteBlockReason = `Cannot permanently delete: Referenced by ${variantsCount} variant specification(s) across active and archived catalog items.`;
    } else if (selectionsCount > 0) {
      canPermanentDelete = false;
      permanentDeleteBlockReason = `Cannot permanently delete: Attribute values are referenced in ${selectionsCount} product configuration selection(s).`;
    } else if (isConfiguredInFilter) {
      canPermanentDelete = false;
      permanentDeleteBlockReason = `Cannot permanently delete: Attribute is currently configured in storefront product filters.`;
    }

    return {
      ...attr,
      dependencyCounts: {
        products: productsCount,
        variants: variantsCount,
        productSelections: selectionsCount,
        filterSettings: isConfiguredInFilter ? 1 : 0,
      },
      canPermanentDelete,
      permanentDeleteBlockReason,
    };
  });
};

export const getAttribute = async (id: string) => {
  const attribute = await prisma.attribute.findUnique({
    where: { id },
    include: {
      values: {
        orderBy: { sortOrder: "asc" },
        include: valueInclude,
      },
      _count: { select: { values: true } },
    },
  });
  if (!attribute) throw new AppError("Attribute not found.", 404);

  const [productsCount, variantsCount, selectionsCount, filterAttrIds] = await Promise.all([
    prisma.productAttribute.count({ where: { attributeId: id } }),
    prisma.productVariantAttributeValue.count({ where: { attributeId: id } }),
    prisma.productAttributeValueSelection.count({
      where: { attributeValue: { attributeId: id } },
    }),
    getFilterConfigAttributeIds(),
  ]);

  const isConfiguredInFilter = filterAttrIds.has(id);
  let canPermanentDelete = true;
  let permanentDeleteBlockReason: string | null = null;

  if (productsCount > 0) {
    canPermanentDelete = false;
    permanentDeleteBlockReason = `Cannot permanently delete: Referenced by ${productsCount} product assignment(s) across active and archived products.`;
  } else if (variantsCount > 0) {
    canPermanentDelete = false;
    permanentDeleteBlockReason = `Cannot permanently delete: Referenced by ${variantsCount} variant specification(s) across active and archived catalog items.`;
  } else if (selectionsCount > 0) {
    canPermanentDelete = false;
    permanentDeleteBlockReason = `Cannot permanently delete: Attribute values are referenced in ${selectionsCount} product configuration selection(s).`;
  } else if (isConfiguredInFilter) {
    canPermanentDelete = false;
    permanentDeleteBlockReason = `Cannot permanently delete: Attribute is currently configured in storefront product filters.`;
  }

  return {
    ...attribute,
    dependencyCounts: {
      products: productsCount,
      variants: variantsCount,
      productSelections: selectionsCount,
      filterSettings: isConfiguredInFilter ? 1 : 0,
    },
    canPermanentDelete,
    permanentDeleteBlockReason,
  };
};

export async function createAttribute(data: {
  name: string;
  role: AttributeRole;
  status?: string;
  sortOrder?: number;
}) {
  const name = data.name.trim();
  await assertUniqueAttributeName(data.name);
  const maxOrder = await prisma.attribute.aggregate({ _max: { sortOrder: true } });
  return prisma.attribute.create({
    data: {
      name,
      slug: slugify(name),
      role: data.role,
      status: (data.status as "ACTIVE" | "INACTIVE") ?? "ACTIVE",
      sortOrder: data.sortOrder ?? (maxOrder._max.sortOrder ?? -1) + 1,
    },
    include: { _count: { select: { values: true } } },
  });
}

export async function updateAttribute(
  id: string,
  data: { name?: string; role?: AttributeRole; status?: string; sortOrder?: number },
) {
  const current = await getAttributeOrThrow(id);
  if (data.name) await assertUniqueAttributeName(data.name, id);
  if (data.role && data.role !== current.role) {
    await validateRoleChange(id, data.role);
  }
  const isNameChanged = Boolean(data.name && data.name.trim() !== current.name);
  return prisma.attribute.update({
    where: { id },
    data: {
      ...(data.name ? { name: data.name.trim(), slug: slugify(data.name) } : {}),
      ...(isNameChanged ? ({ previousName: current.name, renamedAt: new Date() } as any) : {}),
      ...(data.role ? { role: data.role } : {}),
      ...(data.status ? { status: data.status as "ACTIVE" | "INACTIVE" } : {}),
      ...(data.sortOrder != null ? { sortOrder: data.sortOrder } : {}),
    },
    include: { _count: { select: { values: { where: { status: "ACTIVE" } } } } },
  });
}

export const deleteAttribute = async (id: string) => {
  const existing = await prisma.attribute.findUnique({ where: { id } });
  if (!existing) throw new AppError("Attribute not found.", 404);
  if (existing.deletedAt) throw new AppError("Attribute is already archived.", 400);

  return prisma.attribute.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      status: "INACTIVE",
    },
  });
};

export const restoreAttribute = async (id: string) => {
  const existing = await prisma.attribute.findUnique({ where: { id } });
  if (!existing) throw new AppError("Attribute not found.", 404);
  if (!existing.deletedAt) throw new AppError("Attribute is not archived.", 400);

  return prisma.attribute.update({
    where: { id },
    data: {
      deletedAt: null,
      status: "INACTIVE", // Crucial safeguard: restored as INACTIVE, must be explicitly reviewed and enabled
    },
  });
};

export const permanentDeleteAttribute = async (id: string) => {
  const existing = await prisma.attribute.findUnique({ where: { id } });
  if (!existing) throw new AppError("Attribute not found.", 404);

  // Check 1: Products (active + archived)
  const productsCount = await prisma.productAttribute.count({ where: { attributeId: id } });
  if (productsCount > 0) {
    throw new AppError(`Cannot permanently delete: Referenced by ${productsCount} product assignment(s) across active and archived catalog products.`, 400);
  }

  // Check 2: Variants (active + archived)
  const variantsCount = await prisma.productVariantAttributeValue.count({ where: { attributeId: id } });
  if (variantsCount > 0) {
    throw new AppError(`Cannot permanently delete: Referenced by ${variantsCount} product variant(s) across active and archived catalog items.`, 400);
  }

  // Check 3: Selections
  const selectionsCount = await prisma.productAttributeValueSelection.count({
    where: { attributeValue: { attributeId: id } },
  });
  if (selectionsCount > 0) {
    throw new AppError(`Cannot permanently delete: Attribute values are referenced in ${selectionsCount} product configuration selection(s).`, 400);
  }

  // Check 4: Filter settings
  const filterAttrIds = await getFilterConfigAttributeIds();
  if (filterAttrIds.has(id)) {
    throw new AppError("Cannot permanently delete: Attribute is currently configured in storefront product filter settings.", 400);
  }

  // Safe to permanently delete
  return prisma.$transaction(async (tx) => {
    await tx.attributeValue.deleteMany({ where: { attributeId: id } });
    return tx.attribute.delete({ where: { id } });
  });
};

export async function reorderAttributes(items: { id: string; sortOrder: number }[]) {
  await prisma.$transaction(
    items.map((item) =>
      prisma.attribute.update({
        where: { id: item.id },
        data: { sortOrder: item.sortOrder },
      }),
    ),
  );
  return listAttributes();
}

export const listAttributeValues = async (attributeId: string) => {
  await getAttributeOrThrow(attributeId);
  const values = await prisma.attributeValue.findMany({
    where: { attributeId },
    orderBy: { sortOrder: "asc" },
    include: valueInclude,
  });

  if (values.length === 0) return values;

  const valIds = values.map((v) => v.id);
  const [variantRefs, selectionRefs] = await Promise.all([
    prisma.productVariantAttributeValue.groupBy({
      by: ["attributeValueId"],
      where: { attributeValueId: { in: valIds } },
      _count: { _all: true },
    }),
    prisma.productAttributeValueSelection.groupBy({
      by: ["attributeValueId"],
      where: { attributeValueId: { in: valIds } },
      _count: { _all: true },
    }),
  ]);

  const variantMap = new Map(variantRefs.map((r) => [r.attributeValueId, r._count._all]));
  const selectionMap = new Map(selectionRefs.map((r) => [r.attributeValueId, r._count._all]));

  return values.map((v) => {
    const vCount = variantMap.get(v.id) || 0;
    const sCount = selectionMap.get(v.id) || 0;
    let canPermanentDelete = true;
    let permanentDeleteBlockReason: string | null = null;

    if (vCount > 0) {
      canPermanentDelete = false;
      permanentDeleteBlockReason = `Referenced by ${vCount} variant(s) across active and archived products.`;
    } else if (sCount > 0) {
      canPermanentDelete = false;
      permanentDeleteBlockReason = `Referenced by ${sCount} product attribute selection(s).`;
    }

    return {
      ...v,
      dependencyCounts: {
        variants: vCount,
        productSelections: sCount,
      },
      canPermanentDelete,
      permanentDeleteBlockReason,
    };
  });
};

export async function addAttributeValue(attributeId: string, data: ValueInput & { value: string }) {
  const attribute = await getAttributeOrThrow(attributeId);
  const slug = data.slug?.trim() || slugify(data.value);
  const existing = await assertUniqueValueSlug(attributeId, slug);

  const payload: ValueInput = {
    ...data,
    slug,
    value: data.value.trim(),
  };

  if (attribute.role === "Y_GRID" && data.countryId) {
    await assertUniqueCountryPerAttribute(attributeId, data.countryId);
    if (!payload.value) {
      const country = await prisma.country.findUnique({ where: { id: data.countryId } });
      if (country) payload.value = country.name;
    }
  }

  validateValueForRole(getValidationRole(attribute.role, payload), payload);

  const maxOrder = await prisma.attributeValue.aggregate({
    where: { attributeId },
    _max: { sortOrder: true },
  });

  const writeData = {
    attributeId,
    value: payload.value!,
    slug,
    image: data.image ?? null,
    note: data.note ?? null,
    priceAdjustment: decimalOrNull(data.priceAdjustment ?? 0) ?? new Prisma.Decimal(0),
    gridRole: data.gridRole ?? null,
    countryId: data.countryId ?? null,
    moq: data.moq ?? null,
    tierPrice: decimalOrNull(data.tierPrice),
    dealerPrice: decimalOrNull(data.dealerPrice),
    sortOrder: data.sortOrder ?? (maxOrder._max.sortOrder ?? -1) + 1,
    status: (data.status as "ACTIVE" | "INACTIVE") ?? "ACTIVE",
  };

  if (existing) {
    return prisma.attributeValue.update({
      where: { id: existing.id },
      data: { ...writeData, status: "ACTIVE" },
      include: valueInclude,
    });
  }

  return prisma.attributeValue.create({
    data: writeData,
    include: valueInclude,
  });
}

export async function updateAttributeValue(id: string, data: ValueInput) {
  const current = await prisma.attributeValue.findUnique({
    where: { id },
    include: { attribute: true },
  });
  if (!current) throw new AppError("Attribute value not found.", 404);

  const merged: ValueInput = {
    value: data.value ?? current.value,
    slug: data.slug ?? current.slug,
    image: data.image !== undefined ? data.image : current.image,
    note: data.note !== undefined ? data.note : current.note,
    priceAdjustment:
      data.priceAdjustment !== undefined
        ? data.priceAdjustment
        : Number(current.priceAdjustment),
    gridRole: data.gridRole !== undefined ? data.gridRole : current.gridRole,
    countryId: data.countryId !== undefined ? data.countryId : current.countryId,
    moq: data.moq !== undefined ? data.moq : current.moq,
    tierPrice:
      data.tierPrice !== undefined
        ? data.tierPrice
        : current.tierPrice != null
          ? Number(current.tierPrice)
          : null,
    dealerPrice:
      data.dealerPrice !== undefined
        ? data.dealerPrice
        : current.dealerPrice != null
          ? Number(current.dealerPrice)
          : null,
    status: data.status ?? current.status,
    sortOrder: data.sortOrder ?? current.sortOrder,
  };

  if (merged.value && merged.value !== current.value && !data.slug) {
    merged.slug = slugify(merged.value);
  }

  if (merged.slug && merged.slug !== current.slug) {
    await assertUniqueValueSlug(current.attributeId, merged.slug, id);
  }

  if (current.attribute.role === "Y_GRID" && merged.countryId) {
    await assertUniqueCountryPerAttribute(current.attributeId, merged.countryId, id);
    if (data.countryId && !data.value) {
      const country = await prisma.country.findUnique({ where: { id: merged.countryId } });
      if (country) merged.value = country.name;
    }
  }

  validateValueForRole(getValidationRole(current.attribute.role, merged), merged);

  const isValueChanged = Boolean(data.value !== undefined && merged.value!.trim() !== current.value);
  return prisma.attributeValue.update({
    where: { id },
    data: {
      ...(data.value !== undefined ? { value: merged.value!.trim() } : {}),
      ...(isValueChanged ? ({ previousValue: current.value, renamedAt: new Date() } as any) : {}),
      ...(merged.slug ? { slug: merged.slug } : {}),
      ...(data.image !== undefined ? { image: data.image } : {}),
      ...(data.note !== undefined ? { note: data.note } : {}),
      ...(data.priceAdjustment !== undefined
        ? { priceAdjustment: decimalOrNull(data.priceAdjustment) ?? new Prisma.Decimal(0) }
        : {}),
      ...(data.gridRole !== undefined ? { gridRole: data.gridRole } : {}),
      ...(data.countryId !== undefined ? { countryId: data.countryId } : {}),
      ...(data.moq !== undefined ? { moq: data.moq } : {}),
      ...(data.tierPrice !== undefined ? { tierPrice: decimalOrNull(data.tierPrice) } : {}),
      ...(data.dealerPrice !== undefined ? { dealerPrice: decimalOrNull(data.dealerPrice) } : {}),
      ...(data.status ? { status: data.status as "ACTIVE" | "INACTIVE" } : {}),
      ...(data.sortOrder != null ? { sortOrder: data.sortOrder } : {}),
    },
    include: valueInclude,
  });
}

export async function deleteAttributeValue(id: string) {
  const current = await prisma.attributeValue.findUnique({ where: { id } });
  if (!current) throw new AppError("Attribute value not found.", 404);
  return prisma.attributeValue.update({ where: { id }, data: { status: "INACTIVE" } });
}

export async function permanentDeleteAttributeValue(attributeId: string, valueId: string) {
  const current = await prisma.attributeValue.findFirst({
    where: { id: valueId, attributeId },
  });
  if (!current) throw new AppError("Attribute value not found.", 404);

  // Check references across active and archived variants and products
  const [variantRefs, selectionRefs] = await Promise.all([
    prisma.productVariantAttributeValue.count({ where: { attributeValueId: valueId } }),
    prisma.productAttributeValueSelection.count({ where: { attributeValueId: valueId } }),
  ]);

  if (variantRefs > 0) {
    throw new AppError(`Cannot permanently delete value: Referenced by ${variantRefs} variant(s) across active and archived products.`, 400);
  }
  if (selectionRefs > 0) {
    throw new AppError(`Cannot permanently delete value: Referenced by ${selectionRefs} product attribute selection(s).`, 400);
  }

  return prisma.attributeValue.delete({ where: { id: valueId } });
}

export async function reorderAttributeValues(
  attributeId: string,
  items: { id: string; sortOrder: number }[],
) {
  await getAttributeOrThrow(attributeId);
  await prisma.$transaction(
    items.map((item) =>
      prisma.attributeValue.update({
        where: { id: item.id },
        data: { sortOrder: item.sortOrder },
      }),
    ),
  );
  return listAttributeValues(attributeId);
}

export async function bulkPermanentDeleteAttributes(ids: string[]) {
  const deletedIds: string[] = [];
  const blocked: Array<{
    id: string;
    name: string;
    reason: string;
    products?: Array<{ id: string; title: string; sku?: string | null }>;
    variants?: Array<{ id: string; title: string; sku?: string | null; productId: string }>;
  }> = [];

  const uniqueIds = Array.from(new Set((ids ?? []).filter(Boolean)));
  if (uniqueIds.length === 0) {
    return {
      deletedCount: 0,
      blockedCount: 0,
      deletedIds: [],
      blocked: [],
    };
  }

  // 1. Pre-fetch attributes and run batch reference checks in parallel
  const [attributes, productAttrs, variantAttrs, valueSelections, filterAttrIds] = await Promise.all([
    prisma.attribute.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, name: true },
    }),
    prisma.productAttribute.groupBy({
      by: ["attributeId"],
      where: { attributeId: { in: uniqueIds } },
      _count: { _all: true },
    }),
    prisma.productVariantAttributeValue.groupBy({
      by: ["attributeId"],
      where: { attributeId: { in: uniqueIds } },
      _count: { _all: true },
    }),
    prisma.productAttributeValueSelection.findMany({
      where: { attributeValue: { attributeId: { in: uniqueIds } } },
      select: { attributeValue: { select: { attributeId: true } } },
    }),
    getFilterConfigAttributeIds(),
  ]);

  const attributeMap = new Map(attributes.map((a) => [a.id, a]));
  const productCountMap = new Map(productAttrs.map((p) => [p.attributeId, p._count._all]));
  const variantCountMap = new Map(variantAttrs.map((v) => [v.attributeId, v._count._all]));
  const selectionCountMap = new Map<string, number>();
  for (const sel of valueSelections) {
    const aId = sel.attributeValue?.attributeId;
    if (aId) {
      selectionCountMap.set(aId, (selectionCountMap.get(aId) || 0) + 1);
    }
  }

  const eligibleIds: string[] = [];
  const blockedIdsWithReason = new Map<string, string>();

  for (const id of uniqueIds) {
    const attr = attributeMap.get(id);
    if (!attr) {
      blocked.push({ id, name: id, reason: "Attribute not found." });
      continue;
    }

    const pCount = productCountMap.get(id) || 0;
    if (pCount > 0) {
      blockedIdsWithReason.set(id, `Cannot permanently delete: Referenced by ${pCount} product assignment(s) across active and archived catalog products.`);
      continue;
    }

    const vCount = variantCountMap.get(id) || 0;
    if (vCount > 0) {
      blockedIdsWithReason.set(id, `Cannot permanently delete: Referenced by ${vCount} product variant(s) across active and archived catalog items.`);
      continue;
    }

    const sCount = selectionCountMap.get(id) || 0;
    if (sCount > 0) {
      blockedIdsWithReason.set(id, `Cannot permanently delete: Attribute values are referenced in ${sCount} product configuration selection(s).`);
      continue;
    }

    if (filterAttrIds.has(id)) {
      blockedIdsWithReason.set(id, "Cannot permanently delete: Attribute is currently configured in storefront product filter settings.");
      continue;
    }

    eligibleIds.push(id);
  }

  // 2. Fetch sample product and variant previews in a single query for blocked items
  const blockedIdsArray = Array.from(blockedIdsWithReason.keys());
  if (blockedIdsArray.length > 0) {
    const sampleIds = blockedIdsArray.slice(0, 50);
    const [sampleProducts, sampleVariants] = await Promise.all([
      prisma.productAttribute.findMany({
        where: { attributeId: { in: sampleIds } },
        include: { product: { select: { id: true, title: true, sku: true } } },
        take: 300,
      }),
      prisma.productVariantAttributeValue.findMany({
        where: { attributeId: { in: sampleIds } },
        include: { variant: { select: { id: true, title: true, sku: true, productId: true } } },
        take: 300,
      }),
    ]);

    const productMap = new Map<string, Array<{ id: string; title: string; sku?: string | null }>>();
    for (const pa of sampleProducts) {
      if (pa.product) {
        const list = productMap.get(pa.attributeId) || [];
        if (list.length < 10) {
          list.push({ id: pa.product.id, title: pa.product.title, sku: pa.product.sku });
          productMap.set(pa.attributeId, list);
        }
      }
    }

    const variantMap = new Map<string, Array<{ id: string; title: string; sku?: string | null; productId: string }>>();
    for (const va of sampleVariants) {
      if (va.variant) {
        const list = variantMap.get(va.attributeId) || [];
        if (list.length < 10) {
          list.push({ id: va.variant.id, title: va.variant.title, sku: va.variant.sku, productId: va.variant.productId });
          variantMap.set(va.attributeId, list);
        }
      }
    }

    for (const id of blockedIdsArray) {
      const attr = attributeMap.get(id);
      blocked.push({
        id,
        name: attr?.name || id,
        reason: blockedIdsWithReason.get(id) || "Failed to permanently delete attribute.",
        products: productMap.get(id),
        variants: variantMap.get(id),
      });
    }
  }

  // 3. Batch delete unblocked attributes in safe chunks of 100 with fallback
  const CHUNK_SIZE = 100;
  for (let i = 0; i < eligibleIds.length; i += CHUNK_SIZE) {
    const chunk = eligibleIds.slice(i, i + CHUNK_SIZE);
    try {
      await prisma.$transaction(
        async (tx) => {
          await tx.attributeValue.deleteMany({ where: { attributeId: { in: chunk } } });
          await tx.attribute.deleteMany({ where: { id: { in: chunk } } });
        },
        { timeout: 30000 },
      );
      deletedIds.push(...chunk);
    } catch {
      for (const singleId of chunk) {
        try {
          await prisma.$transaction(async (tx) => {
            await tx.attributeValue.deleteMany({ where: { attributeId: singleId } });
            await tx.attribute.delete({ where: { id: singleId } });
          });
          deletedIds.push(singleId);
        } catch (singleErr: any) {
          const attr = attributeMap.get(singleId);
          blocked.push({
            id: singleId,
            name: attr?.name || singleId,
            reason: singleErr?.message || "Failed to permanently delete attribute.",
          });
        }
      }
    }
  }

  return {
    deletedCount: deletedIds.length,
    blockedCount: blocked.length,
    deletedIds,
    blocked,
  };
}

// ─── SPREADSHEET EXPORT & IMPORT ──────────────────────────────────────────────

export const ATTRIBUTE_EXPORT_COLUMNS = [
  { key: "attributeName", header: "attributeName" },
  { key: "slug", header: "slug" },
  { key: "displayType", header: "displayType" },
  { key: "status", header: "status" },
  { key: "sortOrder", header: "sortOrder" },
  { key: "values", header: "values" },
] as const;

function getRowField(row: Record<string, any>, ...possibleKeys: string[]): string {
  if (!row || typeof row !== "object") return "";
  for (const key of possibleKeys) {
    const val = row[key];
    if (val !== undefined && val !== null) {
      if (Array.isArray(val)) {
        const joined = val.map((v) => String(v).trim()).filter(Boolean).join(", ");
        if (joined) return joined;
      } else {
        const str = String(val).trim();
        if (str !== "" && str !== "[object Object]") return str;
      }
    }
  }
  const rowEntries = Object.entries(row);
  for (const key of possibleKeys) {
    const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    const found = rowEntries.find(
      ([k]) => k.toLowerCase().replace(/[^a-z0-9]/g, "") === cleanKey,
    );
    if (found && found[1] !== undefined && found[1] !== null) {
      const val = found[1];
      if (Array.isArray(val)) {
        const joined = val.map((v) => String(v).trim()).filter(Boolean).join(", ");
        if (joined) return joined;
      } else {
        const str = String(val).trim();
        if (str !== "" && str !== "[object Object]") return str;
      }
    }
  }
  return "";
}

function normalizeRole(roleStr: string): AttributeRole {
  if (!roleStr) return "DROPDOWN";
  const upper = roleStr.toUpperCase().trim().replace(/[^A-Z0-9]/g, "_").replace(/_+/g, "_");
  if (upper === "X" || upper === "X_AXIS" || upper.includes("X_GRID") || upper === "XGRID" || upper === "COLUMN") return "X_GRID";
  if (upper === "Y" || upper === "Y_AXIS" || upper.includes("Y_GRID") || upper === "YGRID" || upper === "ROW") return "Y_GRID";
  return "DROPDOWN";
}

function normalizeStatus(stStr: string): AttributeStatus {
  const upper = stStr.toUpperCase().trim();
  if (upper === "INACTIVE" || upper === "DISABLED" || upper === "FALSE" || upper === "0") return "INACTIVE";
  return "ACTIVE";
}

export function parseAttributeValuesString(valuesStr?: string | null): string[] {
  if (!valuesStr) return [];
  const str = String(valuesStr).trim();
  if (!str) return [];

  // Priority 1: Pipe delimiter '|'
  if (str.includes("|")) {
    return str.split("|").map((s) => s.trim()).filter(Boolean);
  }

  // Priority 2: Newlines
  if (str.includes("\n")) {
    return str.split("\n").map((s) => s.trim()).filter(Boolean);
  }

  // Priority 3: Semicolons
  if (str.includes(";")) {
    return str.split(";").map((s) => s.trim()).filter(Boolean);
  }

  // If no pipe/newline/semicolon is used, treat entire string as one single value
  // This preserves values with internal commas like "Hooks on 3,4 & 5"
  return [str];
}

export async function exportAttributesSpreadsheet() {
  const attributes = await prisma.attribute.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      values: {
        orderBy: [{ sortOrder: "asc" }, { value: "asc" }],
      },
    },
  });

  // Exactly 1 row per attribute
  const rows = attributes.map((attr) => {
    const valuesString = attr.values
      .map((v) => {
        const priceAdj = Number(v.priceAdjustment);
        let part = v.value;
        if (priceAdj > 0) {
          part = `${part} (+${priceAdj})`;
        }
        if (v.status === "INACTIVE") {
          part = `${part} [INACTIVE]`;
        }
        return part;
      })
      .join(" | ");

    return {
      attributeName: attr.name,
      slug: attr.slug,
      displayType: attr.role,
      status: attr.status,
      sortOrder: attr.sortOrder,
      values: valuesString,
    };
  });

  return writeSpreadsheetBuffer(
    rows,
    "Attributes",
    ATTRIBUTE_EXPORT_COLUMNS.map((c) => ({ key: c.key, header: c.header })),
  );
}

export function generateSampleAttributesTemplate() {
  const sampleRows = [
    {
      attributeName: "Slot",
      slug: "slot",
      displayType: "X_GRID",
      status: "ACTIVE",
      sortOrder: 1,
      values: ".018 | .022 (+15)",
    },
    {
      attributeName: "Hook Configuration",
      slug: "hook-configuration",
      displayType: "Y_GRID",
      status: "ACTIVE",
      sortOrder: 2,
      values: "Hooks on 3 | Hooks on 3 with Offset | Hooks on 3,4 & 5 | Hooks on 3,4 & 5 with Offset (+12) | No Hooks",
    },
    {
      attributeName: "Prescription",
      slug: "prescription",
      displayType: "DROPDOWN",
      status: "ACTIVE",
      sortOrder: 3,
      values: "MBT | Roth | Alexander (+12) | Standard Edgewise",
    },
    {
      attributeName: "Wire Size",
      slug: "wire-size",
      displayType: "X_GRID",
      status: "ACTIVE",
      sortOrder: 4,
      values: ".014 | .016 | .018 | .018 x .025 | .019 x .025 (+20)",
    },
    {
      attributeName: "Arch",
      slug: "arch",
      displayType: "Y_GRID",
      status: "ACTIVE",
      sortOrder: 5,
      values: "Upper | Lower",
    },
    {
      attributeName: "Material",
      slug: "material",
      displayType: "DROPDOWN",
      status: "ACTIVE",
      sortOrder: 6,
      values: "Stainless Steel | Titanium (+25) | Ceramic (+40)",
    },
    {
      attributeName: "Size",
      slug: "size",
      displayType: "DROPDOWN",
      status: "ACTIVE",
      sortOrder: 7,
      values: ".012 | .014 (+6) | .016 (+12)",
    },
    {
      attributeName: "Pack Size",
      slug: "pack-size",
      displayType: "DROPDOWN",
      status: "ACTIVE",
      sortOrder: 8,
      values: "Individual Brackets - Pk of 10 pcs | Kit of 20 Brackets (+35) | Full Case (+60)",
    },
  ];

  return writeSpreadsheetBuffer(
    sampleRows,
    "Attributes",
    ATTRIBUTE_EXPORT_COLUMNS.map((c) => ({ key: c.key, header: c.header })),
  );
}

export async function previewAttributeImport(filePath: string) {
  const rawRows = readSpreadsheetRows(filePath);
  const issues: Array<{ row: number; field: string; message: string }> = [];
  const duplicateWarnings: string[] = [];

  type AggregatedAttrPreview = {
    rowNumber: number;
    attrName: string;
    slug?: string;
    role: AttributeRole;
    status: AttributeStatus;
    sortOrder: number;
    values: string[];
  };

  const aggregatedMap = new Map<string, AggregatedAttrPreview>();

  rawRows.forEach((row, index) => {
    const rowNumber = index + 2;
    const attrName = getRowField(row, "attributeName", "name", "attribute", "attribute_name", "title");
    const roleStr = getRowField(row, "displayType", "role", "display_type", "type", "gridAxis");
    const valuesStr = getRowField(row, "values", "value", "options", "attributeValues", "allowedValues");
    const slugStr = getRowField(row, "slug", "attributeSlug");
    const statusStr = getRowField(row, "status", "attributeStatus");
    const rawSortOrder = Number(getRowField(row, "sortOrder", "attributeSortOrder", "order", "sort"));
    const sortOrder = Number.isFinite(rawSortOrder) ? rawSortOrder : index + 1;

    if (!attrName) {
      issues.push({ row: rowNumber, field: "attributeName", message: "Attribute name is required." });
      return;
    }

    const key = (slugStr || attrName).toLowerCase();
    const roleVal = normalizeRole(roleStr);
    const statusVal = normalizeStatus(statusStr);
    const rowValues = parseAttributeValuesString(valuesStr);

    if (!aggregatedMap.has(key)) {
      aggregatedMap.set(key, {
        rowNumber,
        attrName,
        slug: slugStr,
        role: roleVal,
        status: statusVal,
        sortOrder,
        values: [...rowValues],
      });
    } else {
      const existing = aggregatedMap.get(key)!;
      if (existing.role === "DROPDOWN" && roleVal !== "DROPDOWN") {
        existing.role = roleVal;
      }
      for (const val of rowValues) {
        if (!existing.values.some((v) => v.toLowerCase() === val.toLowerCase())) {
          existing.values.push(val);
        }
      }
    }
  });

  const previewRows = Array.from(aggregatedMap.values()).map((agg) => {
    const valuesString = agg.values.join(" | ");
    return {
      row: agg.rowNumber,
      rowNumber: agg.rowNumber,
      attributeName: agg.attrName,
      name: agg.attrName,
      slug: agg.slug,
      displayType: agg.role,
      role: agg.role,
      status: agg.status,
      sortOrder: agg.sortOrder,
      values: valuesString,
      valueCount: agg.values.length,
      isValid: true,
      errors: [] as string[],
    };
  });

  return {
    totalRows: previewRows.length,
    validRows: previewRows.length,
    invalidRows: issues.length,
    issues,
    duplicateWarnings,
    sampleRows: previewRows.slice(0, 10),
    rows: previewRows,
  };
}

export async function importAttributesSpreadsheet(filePathOrRows: string | any[]) {
  const rawRows: Record<string, any>[] = Array.isArray(filePathOrRows)
    ? filePathOrRows
    : readSpreadsheetRows(filePathOrRows);

  if (rawRows.length === 0) {
    throw new AppError("Uploaded spreadsheet or rows list is empty.", 400);
  }

  if (typeof filePathOrRows === "string") {
    const preview = await previewAttributeImport(filePathOrRows);
    if (preview.issues.length > 0) {
      throw new AppError(`Spreadsheet validation failed with ${preview.issues.length} issue(s).`, 400);
    }
  }

  type AggregatedImportAttr = {
    attrName: string;
    slugProvided?: string;
    role: AttributeRole;
    status: AttributeStatus;
    sortOrder: number;
    values: string[];
  };

  const aggregatedMap = new Map<string, AggregatedImportAttr>();

  for (const [index, row] of rawRows.entries()) {
    const attrName = getRowField(row, "attributeName", "name", "attribute", "attribute_name", "title");
    if (!attrName) continue;

    const slugProvided = getRowField(row, "slug", "attributeSlug");
    const roleStr = getRowField(row, "displayType", "role", "display_type", "type", "gridAxis");
    const attrStatusStr = getRowField(row, "status", "attributeStatus", "state");
    const attrSortStr = getRowField(row, "sortOrder", "attributeSortOrder", "order", "sort");
    const valuesStr = getRowField(row, "values", "value", "options", "attributeValues", "allowedValues");

    const role = normalizeRole(roleStr || "DROPDOWN");
    const status = normalizeStatus(attrStatusStr || "ACTIVE");
    const sortOrder = attrSortStr ? parseInt(attrSortStr, 10) || 0 : index + 1;
    const rowValues = parseAttributeValuesString(valuesStr);

    const key = (slugProvided || attrName).toLowerCase();

    if (!aggregatedMap.has(key)) {
      aggregatedMap.set(key, {
        attrName,
        slugProvided,
        role,
        status,
        sortOrder,
        values: [...rowValues],
      });
    } else {
      const existing = aggregatedMap.get(key)!;
      if (existing.role === "DROPDOWN" && role !== "DROPDOWN") {
        existing.role = role;
      }
      for (const val of rowValues) {
        if (!existing.values.some((v) => v.toLowerCase() === val.toLowerCase())) {
          existing.values.push(val);
        }
      }
    }
  }

  const summary = {
    createdAttributes: 0,
    updatedAttributes: 0,
    createdValues: 0,
    updatedValues: 0,
    totalProcessed: aggregatedMap.size,
  };

  const items = Array.from(aggregatedMap.values());
  const CHUNK_SIZE = 50;
  let index = 0;

  for (let chunkStart = 0; chunkStart < items.length; chunkStart += CHUNK_SIZE) {
    const chunk = items.slice(chunkStart, chunkStart + CHUNK_SIZE);
    await prisma.$transaction(async (tx) => {
      for (const item of chunk) {
        index++;
        const attrName = item.attrName;
        const role = item.role;
        const status = item.status;
        const sortOrder = item.sortOrder;
        const attrSlug = item.slugProvided ? slugify(item.slugProvided) : slugify(attrName);
        const finalAttrSlug = attrSlug || `attr-${index}`;

        let attribute = await tx.attribute.findFirst({
          where: {
            OR: [
              { name: { equals: attrName, mode: "insensitive" } },
              { slug: finalAttrSlug },
            ],
          },
        });

        if (attribute) {
          attribute = await tx.attribute.update({
            where: { id: attribute.id },
            data: {
              name: attrName,
              role,
              status,
              sortOrder,
            },
          });
          summary.updatedAttributes++;
        } else {
          let uniqueSlug = finalAttrSlug;
          let counter = 1;
          while (await tx.attribute.findUnique({ where: { slug: uniqueSlug } })) {
            uniqueSlug = `${finalAttrSlug}-${counter++}`;
          }
          attribute = await tx.attribute.create({
            data: {
              name: attrName,
              slug: uniqueSlug,
              role,
              status,
              sortOrder,
            },
          });
          summary.createdAttributes++;
        }

        // If values are provided, parse and upsert them
        for (const [vIdx, rawItem] of item.values.entries()) {
          let valName = rawItem.trim();
          let priceAdj = 0;
          let explicitStatus: AttributeStatus | null = null;

          // Check if format has [INACTIVE] or [ACTIVE] tag (or (INACTIVE) / (ACTIVE) / (DISABLED))
          const statusMatch = valName.match(/\s*[\[\(](INACTIVE|ACTIVE|DISABLED)[\]\)]\s*$/i);
          if (statusMatch) {
            const tag = statusMatch[1].toUpperCase();
            explicitStatus = tag === "INACTIVE" || tag === "DISABLED" ? "INACTIVE" : "ACTIVE";
            valName = valName.replace(/\s*[\[\(](INACTIVE|ACTIVE|DISABLED)[\]\)]\s*$/i, "").trim();
          }

          // Check if format is "Name (+12)" or "Name (12)"
          const priceMatch = valName.match(/^(.*?)\s*\(\+?([0-9.]+)\)$/);
          if (priceMatch) {
            valName = priceMatch[1].trim();
            priceAdj = parseFloat(priceMatch[2]) || 0;
          }

          // Also check if status tag was placed before price adjustment, e.g. "Name [INACTIVE] (+12)"
          if (!explicitStatus) {
            const innerStatusMatch = valName.match(/\s*[\[\(](INACTIVE|ACTIVE|DISABLED)[\]\)]\s*$/i);
            if (innerStatusMatch) {
              const tag = innerStatusMatch[1].toUpperCase();
              explicitStatus = tag === "INACTIVE" || tag === "DISABLED" ? "INACTIVE" : "ACTIVE";
              valName = valName.replace(/\s*[\[\(](INACTIVE|ACTIVE|DISABLED)[\]\)]\s*$/i, "").trim();
            }
          }

          if (!valName) continue;

          const rawValSlug = slugify(valName);
          const valSlug = rawValSlug || `val-${vIdx + 1}`;
          const existingVal = await tx.attributeValue.findFirst({
            where: {
              attributeId: attribute.id,
              value: { equals: valName, mode: "insensitive" },
            },
          });

          const valSortOrder = vIdx + 1;

          if (existingVal) {
            await tx.attributeValue.update({
              where: { id: existingVal.id },
              data: {
                value: valName,
                status: explicitStatus ?? existingVal.status,
                sortOrder: valSortOrder,
                priceAdjustment: new Prisma.Decimal(priceAdj),
              },
            });
            summary.updatedValues++;
          } else {
            let uniqueValSlug = valSlug;
            let counter = 1;
            while (
              await tx.attributeValue.findFirst({ where: { attributeId: attribute.id, slug: uniqueValSlug } })
            ) {
              uniqueValSlug = `${valSlug}-${counter++}`;
            }

            await tx.attributeValue.create({
              data: {
                attributeId: attribute.id,
                value: valName,
                slug: uniqueValSlug,
                status: explicitStatus ?? "ACTIVE",
                sortOrder: valSortOrder,
                priceAdjustment: new Prisma.Decimal(priceAdj),
              },
            });
            summary.createdValues++;
          }
        }
      }
    }, { timeout: 30000, maxWait: 10000 });
  }

  return summary;
}
