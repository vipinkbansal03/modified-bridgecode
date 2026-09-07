import { AttributeRole, Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { AppError, slugify } from "../../utils/apiResponse";

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

  if ((role === "DROPDOWN" || role === "X_GRID" || role === "Y_GRID") && countryId) {
    const hasLegacyPricingFields = moq != null || tierPrice != null || dealerPrice != null;
    if (!hasLegacyPricingFields) {
      throw new AppError("Country-scoped attribute values must include at least one legacy pricing field.", 400);
    }
  }

  if ((role === "DROPDOWN" || role === "X_GRID" || role === "Y_GRID") && gridRole && countryId) {
    throw new AppError("Grid role and country-specific attribute pricing cannot be combined on the same value.", 400);
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
  return prisma.attribute.update({
    where: { id },
    data: {
      ...(data.name ? { name: data.name.trim(), slug: slugify(data.name) } : {}),
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

  return prisma.attributeValue.update({
    where: { id },
    data: {
      ...(data.value !== undefined ? { value: merged.value!.trim() } : {}),
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
  const blocked: Array<{ id: string; name: string; reason: string }> = [];

  for (const id of ids) {
    try {
      const attr = await prisma.attribute.findUnique({
        where: { id },
        select: { id: true, name: true },
      });
      if (!attr) {
        blocked.push({ id, name: id, reason: "Attribute not found." });
        continue;
      }
      await permanentDeleteAttribute(id);
      deletedIds.push(id);
    } catch (error: any) {
      const attr = await prisma.attribute.findUnique({
        where: { id },
        select: { name: true },
      });
      blocked.push({
        id,
        name: attr?.name || id,
        reason: error?.message || "Failed to permanently delete attribute.",
      });
    }
  }

  return {
    deletedCount: deletedIds.length,
    blockedCount: blocked.length,
    deletedIds,
    blocked,
  };
}
