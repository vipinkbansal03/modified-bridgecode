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

  if (role === "DROPDOWN") {
    if (gridRole || countryId || moq != null || tierPrice != null || dealerPrice != null) {
      throw new AppError(
        "DROPDOWN values cannot have grid role, country, MOQ, or tier/dealer pricing fields.",
        400,
      );
    }
    return;
  }

  if (role === "X_GRID") {
    if (!gridRole || (gridRole !== "ROW" && gridRole !== "COLUMN")) {
      throw new AppError("X_GRID values must have gridRole set to ROW or COLUMN.", 400);
    }
    if (countryId || moq != null || tierPrice != null || dealerPrice != null) {
      throw new AppError("X_GRID values cannot have country or Y-Grid pricing fields.", 400);
    }
    return;
  }

  if (role === "Y_GRID") {
    if (gridRole) {
      throw new AppError("Y_GRID values cannot have gridRole.", 400);
    }
    if (!countryId) {
      throw new AppError("Y_GRID values must have a country selected.", 400);
    }
    if (moq == null && tierPrice == null && dealerPrice == null) {
      throw new AppError(
        "Y_GRID values must have at least one of MOQ, Tier Price, or Dealer Price.",
        400,
      );
    }
  }
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
  return prisma.attribute.update({ where: { id }, data: { status: "INACTIVE" } });
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

  validateValueForRole(attribute.role, payload);

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

  validateValueForRole(current.attribute.role, merged);

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
