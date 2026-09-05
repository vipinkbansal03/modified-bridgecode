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

export const listAttributes = () =>
  prisma.attribute.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      values: {
        where: { status: "ACTIVE" },
        orderBy: { sortOrder: "asc" },
        select: { id: true, value: true, sortOrder: true },
      },
      _count: { select: { values: { where: { status: "ACTIVE" } } } },
    },
  });

export const getAttribute = async (id: string) => {
  const attribute = await prisma.attribute.findUnique({
    where: { id },
    include: {
      values: {
        orderBy: { sortOrder: "asc" },
        include: valueInclude,
      },
      _count: { select: { values: { where: { status: "ACTIVE" } } } },
    },
  });
  if (!attribute) throw new AppError("Attribute not found.", 404);
  return attribute;
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
  await getAttributeOrThrow(id);

  // Check if any active (non-soft-deleted) variants are using this attribute
  const count = await prisma.productVariantAttributeValue.count({
    where: {
      attributeId: id,
      variant: {
        product: {
          deletedAt: null,
        },
      },
    },
  });

  if (count > 0) {
    // If it's in use, we cannot delete it, so we deactivate it.
    await prisma.attribute.update({
      where: { id },
      data: { status: "INACTIVE" },
    });
    throw new AppError("Attribute is in use by products/variants. It has been deactivated instead of deleted.", 400);
  }

  // Otherwise, delete associated options and relations (including links on soft-deleted variants), then delete the attribute
  return prisma.$transaction(async (tx) => {
    await tx.productVariantAttributeValue.deleteMany({ where: { attributeId: id } });
    await tx.productAttributeValueSelection.deleteMany({
      where: {
        attributeValue: {
          attributeId: id,
        },
      },
    });
    await tx.attributeValue.deleteMany({ where: { attributeId: id } });
    await tx.productAttribute.deleteMany({ where: { attributeId: id } });

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
  return prisma.attributeValue.findMany({
    where: { attributeId },
    orderBy: { sortOrder: "asc" },
    include: valueInclude,
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
  const upper = roleStr.toUpperCase().trim().replace(/[^A-Z0-9]/g, "_").replace(/_+/g, "_");
  if (upper.includes("X_GRID") || upper === "XGRID" || upper.includes("X_AXIS") || upper === "COLUMN") return "X_GRID";
  if (upper.includes("Y_GRID") || upper === "YGRID" || upper.includes("Y_AXIS") || upper === "ROW") return "Y_GRID";
  return "DROPDOWN";
}

function normalizeStatus(stStr: string): AttributeStatus {
  const upper = stStr.toUpperCase().trim();
  if (upper === "INACTIVE" || upper === "DISABLED" || upper === "FALSE" || upper === "0") return "INACTIVE";
  return "ACTIVE";
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
        if (priceAdj > 0) {
          return `${v.value} (+${priceAdj})`;
        }
        return v.value;
      })
      .join(", ");

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
      values: ".018, .022 (+15)",
    },
    {
      attributeName: "Hook",
      slug: "hook",
      displayType: "Y_GRID",
      status: "ACTIVE",
      sortOrder: 2,
      values: "None, Hook 3, Hook 4 (+8), Hook 5 (+12)",
    },
    {
      attributeName: "Prescription",
      slug: "prescription",
      displayType: "DROPDOWN",
      status: "ACTIVE",
      sortOrder: 3,
      values: "MBT, Roth, Alexander (+12), Standard Edgewise",
    },
    {
      attributeName: "Wire Size",
      slug: "wire-size",
      displayType: "X_GRID",
      status: "ACTIVE",
      sortOrder: 4,
      values: ".014, .016, .018, .018 x .025, .019 x .025 (+20)",
    },
    {
      attributeName: "Arch",
      slug: "arch",
      displayType: "Y_GRID",
      status: "ACTIVE",
      sortOrder: 5,
      values: "Upper, Lower",
    },
    {
      attributeName: "Material",
      slug: "material",
      displayType: "DROPDOWN",
      status: "ACTIVE",
      sortOrder: 6,
      values: "Stainless Steel, Titanium (+25), Ceramic (+40)",
    },
    {
      attributeName: "Size",
      slug: "size",
      displayType: "DROPDOWN",
      status: "ACTIVE",
      sortOrder: 7,
      values: ".012, .014 (+6), .016 (+12)",
    },
    {
      attributeName: "Pack Size",
      slug: "pack-size",
      displayType: "DROPDOWN",
      status: "ACTIVE",
      sortOrder: 8,
      values: "Single, 5 Pack (+35), 10 Pack (+60)",
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
  const previewRows: Record<string, unknown>[] = [];

  const seenAttrNames = new Set<string>();

  rawRows.forEach((row, index) => {
    const rowNumber = index + 2;
    const attrName = getRowField(row, "attributeName", "name", "attribute", "attribute_name", "title");
    const roleStr = getRowField(row, "displayType", "role", "display_type", "type", "gridAxis");
    const valuesStr = getRowField(row, "values", "value", "options", "attributeValues", "allowedValues");

    if (!attrName) {
      issues.push({ row: rowNumber, field: "attributeName", message: "Attribute name is required." });
    } else {
      const lower = attrName.toLowerCase();
      if (seenAttrNames.has(lower)) {
        duplicateWarnings.push(`Duplicate attribute '${attrName}' found on row ${rowNumber}.`);
      } else {
        seenAttrNames.add(lower);
      }
    }

    if (roleStr) {
      const upper = roleStr.toUpperCase().trim().replace(/[^A-Z0-9]/g, "_").replace(/_+/g, "_");
      const isValidRole =
        upper.includes("X_GRID") ||
        upper === "XGRID" ||
        upper.includes("X_AXIS") ||
        upper === "COLUMN" ||
        upper.includes("Y_GRID") ||
        upper === "YGRID" ||
        upper.includes("Y_AXIS") ||
        upper === "ROW" ||
        upper.includes("DROPDOWN") ||
        upper.includes("DROP_DOWN") ||
        upper === "SELECT";
      if (!isValidRole) {
        issues.push({
          row: rowNumber,
          field: "displayType",
          message: `Invalid display type '${roleStr}'. Must be DROPDOWN, X_GRID, or Y_GRID.`,
        });
      }
    }

    const valList = valuesStr ? valuesStr.split(",").map((s: string) => s.trim()).filter(Boolean) : [];
    const valueCount = valList.length;
    const rawSortOrder = Number(getRowField(row, "sortOrder", "attributeSortOrder", "order", "sort"));
    const sortOrder = Number.isFinite(rawSortOrder) ? rawSortOrder : 0;

    const rowIssues = issues
      .filter((i) => i.row === rowNumber)
      .map((i) => (i.field ? `[${i.field}] ${i.message}` : i.message));

    const roleVal = roleStr ? normalizeRole(roleStr) : "DROPDOWN";
    previewRows.push({
      row: rowNumber,
      rowNumber,
      attributeName: attrName,
      name: attrName,
      slug: getRowField(row, "slug", "attributeSlug"),
      displayType: roleVal,
      role: roleVal,
      status: normalizeStatus(getRowField(row, "status", "attributeStatus")),
      sortOrder,
      values: valuesStr,
      valueCount,
      isValid: rowIssues.length === 0,
      errors: rowIssues,
    });
  });

  return {
    totalRows: rawRows.length,
    validRows: Math.max(0, rawRows.length - issues.length),
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

  const summary = {
    createdAttributes: 0,
    updatedAttributes: 0,
    createdValues: 0,
    updatedValues: 0,
    totalProcessed: rawRows.length,
  };

  await prisma.$transaction(async (tx) => {
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
      const attrSlug = slugProvided ? slugify(slugProvided) : slugify(attrName);
      const finalAttrSlug = attrSlug || `attr-${index + 1}`;

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
      if (valuesStr) {
        const rawValueItems = valuesStr.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);

        for (const [vIdx, rawItem] of rawValueItems.entries()) {
          let valName = rawItem;
          let priceAdj = 0;

          // Check if format is "Name (+12)" or "Name (12)"
          const priceMatch = rawItem.match(/^(.*?)\s*\(\+?([0-9.]+)\)$/);
          if (priceMatch) {
            valName = priceMatch[1].trim();
            priceAdj = parseFloat(priceMatch[2]) || 0;
          }

          if (!valName) continue;

          const rawValSlug = slugify(valName);
          const valSlug = rawValSlug || `val-${vIdx + 1}`;
          const existingVal = await tx.attributeValue.findFirst({
            where: {
              attributeId: attribute.id,
              OR: [
                { value: { equals: valName, mode: "insensitive" } },
                { slug: valSlug },
              ],
            },
          });

          const valSortOrder = vIdx + 1;

          if (existingVal) {
            await tx.attributeValue.update({
              where: { id: existingVal.id },
              data: {
                value: valName,
                status: "ACTIVE",
                sortOrder: valSortOrder,
                priceAdjustment: new Prisma.Decimal(priceAdj),
              },
            });
            summary.updatedValues++;
          } else {
            let uniqueValSlug = valSlug;
            let valCounter = 1;
            while (
              await tx.attributeValue.findFirst({
                where: { attributeId: attribute.id, slug: uniqueValSlug },
              })
            ) {
              uniqueValSlug = `${valSlug}-${valCounter++}`;
            }

            await tx.attributeValue.create({
              data: {
                attributeId: attribute.id,
                value: valName,
                slug: uniqueValSlug,
                status: "ACTIVE",
                sortOrder: valSortOrder,
                priceAdjustment: new Prisma.Decimal(priceAdj),
              },
            });
            summary.createdValues++;
          }
        }
      }
    }
  });

  return summary;
}
