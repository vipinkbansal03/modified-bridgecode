import { DiscountType, Prisma, Status } from "@prisma/client";
import { prisma } from "../../config/database";
import { AppError, getPagination } from "../../utils/apiResponse";

type CouponInput = {
  code?: string;
  description?: string | null;
  discountType?: DiscountType;
  discountValue?: number | string | Prisma.Decimal | null;
  minOrderValue?: number | string | Prisma.Decimal | null;
  maxDiscount?: number | string | Prisma.Decimal | null;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  usageLimit?: number | string | null;
  countryId?: string | null;
  countryIds?: string[] | null;
  currencyId?: string | null;
  status?: Status;
};

type CouponListQuery = {
  page?: string;
  limit?: string;
  search?: string;
  status?: string;
  sortBy?: string;
  sortDir?: string;
};

function blankToNull(value: unknown) {
  return value === "" || value === undefined ? null : value;
}

function normalizeCode(value: unknown) {
  const code = String(value ?? "").trim().toUpperCase();
  if (!code) throw new AppError("Coupon code is required.", 400);
  if (!/^[A-Z0-9_-]{3,30}$/.test(code)) {
    throw new AppError("Coupon code must be 3-30 characters and use only letters, numbers, hyphen or underscore.", 400);
  }
  return code;
}

function decimalOrNull(value: unknown, field: string) {
  const normalized = blankToNull(value);
  if (normalized === null) return null;
  const numberValue = Number(normalized);
  if (Number.isNaN(numberValue) || numberValue < 0) {
    throw new AppError(`${field} must be a non-negative number.`, 400);
  }
  return new Prisma.Decimal(numberValue);
}

function requiredDecimal(value: unknown, field: string) {
  const decimal = decimalOrNull(value, field);
  if (decimal === null || decimal.lte(0)) {
    throw new AppError(`${field} must be greater than 0.`, 400);
  }
  return decimal;
}

function intOrNull(value: unknown, field: string) {
  const normalized = blankToNull(value);
  if (normalized === null) return null;
  const numberValue = Number(normalized);
  if (!Number.isInteger(numberValue) || numberValue < 1) {
    throw new AppError(`${field} must be a positive integer.`, 400);
  }
  return numberValue;
}

function requiredDate(value: unknown, field: string) {
  const normalized = blankToNull(value);
  if (normalized === null) throw new AppError(`${field} is required.`, 400);
  const date = normalized instanceof Date ? normalized : new Date(String(normalized));
  if (Number.isNaN(date.getTime())) throw new AppError(`${field} must be a valid date.`, 400);
  return date;
}

async function assertExists(model: "country" | "currency", id: string | null) {
  if (!id) return;
  const exists =
    model === "country"
      ? await prisma.country.findUnique({ where: { id }, select: { id: true } })
      : await prisma.currency.findUnique({ where: { id }, select: { id: true } });

  if (!exists) throw new AppError(`${model} not found.`, 404);
}

async function normalizeCouponInput(input: CouponInput, currentId?: string) {
  const code = normalizeCode(input.code);
  const discountType = input.discountType;
  if (!discountType || !["PERCENTAGE", "FIXED"].includes(discountType)) {
    throw new AppError("Discount type must be PERCENTAGE or FIXED.", 400);
  }

  const discountValue = requiredDecimal(input.discountValue, "Discount value");
  if (discountType === "PERCENTAGE" && discountValue.gt(100)) {
    throw new AppError("Percentage discount cannot exceed 100.", 400);
  }

  const minOrderValue = decimalOrNull(input.minOrderValue, "Minimum order value");
  const maxDiscount = decimalOrNull(input.maxDiscount, "Maximum discount");
  if (discountType === "FIXED" && maxDiscount !== null) {
    throw new AppError("Maximum discount is only needed for percentage coupons.", 400);
  }

  const startDate = requiredDate(input.startDate, "Start date");
  const endDate = requiredDate(input.endDate, "End date");
  if (endDate < startDate) throw new AppError("End date must be after start date.", 400);

  const usageLimit = intOrNull(input.usageLimit, "Usage limit");
  const rawCountryIds = Array.isArray(input.countryIds)
    ? input.countryIds.filter(Boolean)
    : input.countryId
    ? [input.countryId]
    : [];
  const countryIds = [...new Set(rawCountryIds)];
  const countryId = countryIds[0] ?? (blankToNull(input.countryId) as string | null);
  const currencyId = blankToNull(input.currencyId) as string | null;
  const status = input.status ?? "ACTIVE";
  if (!["ACTIVE", "INACTIVE"].includes(status)) throw new AppError("Status must be ACTIVE or INACTIVE.", 400);

  if (countryIds.length > 0) {
    const existingCountries = await prisma.country.findMany({
      where: { id: { in: countryIds } },
      select: { id: true },
    });
    if (existingCountries.length !== countryIds.length) {
      throw new AppError("One or more selected countries were not found.", 404);
    }
  } else if (countryId) {
    await assertExists("country", countryId);
  }
  await assertExists("currency", currencyId);

  const duplicate = await prisma.coupon.findUnique({ where: { code }, select: { id: true } });
  if (duplicate && duplicate.id !== currentId) {
    throw new AppError("A coupon with this code already exists.", 409);
  }

  return {
    code,
    description: String(input.description ?? "").trim() || null,
    discountType,
    discountValue,
    minOrderValue,
    maxDiscount,
    startDate,
    endDate,
    usageLimit,
    countryId,
    countryIds,
    currencyId,
    status,
  };
}

export type EffectiveCouponStatus = "ACTIVE" | "SCHEDULED" | "EXPIRED" | "INACTIVE";

export function getEffectiveStatus(
  status: Status | string,
  startDate: Date | string,
  endDate: Date | string,
  now: Date = new Date()
): EffectiveCouponStatus {
  if (status !== "ACTIVE") {
    return "INACTIVE";
  }
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (now < start) {
    return "SCHEDULED";
  }
  if (now > end) {
    return "EXPIRED";
  }
  return "ACTIVE";
}

const couponInclude = {
  country: true,
  currency: true,
  countries: {
    include: { country: true },
  },
};

function formatCouponResponse(coupon: any, now: Date = new Date()) {
  const countryIds = coupon.countries?.length > 0
    ? coupon.countries.map((c: any) => c.countryId)
    : (coupon.countryId ? [coupon.countryId] : []);
  return {
    ...coupon,
    countryIds,
    effectiveStatus: getEffectiveStatus(coupon.status, coupon.startDate, coupon.endDate, now),
  };
}

export async function listCoupons(query: CouponListQuery) {
  const { page, limit, skip } = getPagination(query);
  const search = query.search?.trim();
  const status = query.status?.trim().toUpperCase();
  if (status && !["ACTIVE", "SCHEDULED", "EXPIRED", "INACTIVE"].includes(status)) {
    throw new AppError("Invalid coupon status.", 400);
  }

  const now = new Date();
  const where: Prisma.CouponWhereInput = {
    ...(status === "INACTIVE"
      ? { status: "INACTIVE" }
      : status === "ACTIVE"
      ? { status: "ACTIVE", startDate: { lte: now }, endDate: { gte: now } }
      : status === "SCHEDULED"
      ? { status: "ACTIVE", startDate: { gt: now } }
      : status === "EXPIRED"
      ? { status: "ACTIVE", endDate: { lt: now } }
      : {}),
    ...(search
      ? {
          OR: [
            { code: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const sortDir = query.sortDir === "asc" ? "asc" : "desc";
  const orderBy = (() => {
    switch (query.sortBy) {
      case "code":
        return [{ code: sortDir }, { createdAt: "desc" }];
      case "discountValue":
        return [{ discountValue: sortDir }, { createdAt: "desc" }];
      case "usedCount":
        return [{ usedCount: sortDir }, { createdAt: "desc" }];
      case "startDate":
        return [{ startDate: sortDir }, { createdAt: "desc" }];
      case "endDate":
        return [{ endDate: sortDir }, { createdAt: "desc" }];
      case "status":
        return [{ status: sortDir }, { createdAt: "desc" }];
      case "createdAt":
      default:
        return [{ createdAt: sortDir }];
    }
  })();

  const [data, total] = await Promise.all([
    prisma.coupon.findMany({
      where,
      skip,
      take: limit,
      orderBy: orderBy as never,
      include: couponInclude,
    }),
    prisma.coupon.count({ where }),
  ]);

  const couponsWithEffectiveStatus = data.map((coupon) => formatCouponResponse(coupon, now));

  return { data: couponsWithEffectiveStatus, total, page, limit };
}

export async function createCoupon(input: CouponInput) {
  const data = await normalizeCouponInput(input);
  const { countryIds, ...couponData } = data;
  const coupon = await prisma.coupon.create({
    data: {
      ...couponData,
      countries: countryIds.length > 0
        ? { create: countryIds.map((cId) => ({ countryId: cId })) }
        : undefined,
    } as Prisma.CouponUncheckedCreateInput,
    include: couponInclude,
  });
  return formatCouponResponse(coupon);
}

export async function updateCoupon(id: string, input: CouponInput) {
  const current = await prisma.coupon.findUnique({ where: { id }, include: couponInclude });
  if (!current) throw new AppError("Coupon not found.", 404);

  const data = await normalizeCouponInput({ ...current, ...input }, id);
  const { countryIds, ...couponData } = data;

  await prisma.couponCountry.deleteMany({ where: { couponId: id } });

  const coupon = await prisma.coupon.update({
    where: { id },
    data: {
      ...couponData,
      countries: countryIds.length > 0
        ? { create: countryIds.map((cId) => ({ countryId: cId })) }
        : undefined,
    } as Prisma.CouponUncheckedUpdateInput,
    include: couponInclude,
  });
  return formatCouponResponse(coupon);
}

export const deleteCoupon = (id: string) => prisma.coupon.delete({ where: { id } });

export async function validateCoupon(code: string, orderTotal: number, countryCode?: string) {
  const normalizedCode = code.trim().toUpperCase();
  if (!normalizedCode) throw new AppError("Coupon code is required.", 400);
  if (!Number.isFinite(orderTotal) || orderTotal <= 0) throw new AppError("Order value must be greater than 0.", 400);

  const coupon = await prisma.coupon.findUnique({
    where: { code: normalizedCode },
    include: {
      country: true,
      currency: true,
      countries: { include: { country: true } },
    },
  });
  if (!coupon) throw new AppError("Coupon not found.", 404);

  const effectiveStatus = getEffectiveStatus(coupon.status, coupon.startDate, coupon.endDate);
  if (effectiveStatus === "INACTIVE") throw new AppError("Coupon is inactive.", 400);
  if (effectiveStatus === "SCHEDULED") throw new AppError("Coupon has not started yet.", 400);
  if (effectiveStatus === "EXPIRED") throw new AppError("Coupon has expired.", 400);

  const allowedCountryCodes = coupon.countries?.length > 0
    ? coupon.countries.map((c) => c.country?.code?.toUpperCase()).filter(Boolean)
    : coupon.country?.code
    ? [coupon.country.code.toUpperCase()]
    : [];

  if (allowedCountryCodes.length > 0) {
    if (!countryCode || !allowedCountryCodes.includes(countryCode.toUpperCase())) {
      throw new AppError("Coupon is not available in your region.", 400);
    }
  }

  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
    throw new AppError("Coupon usage limit reached.", 400);
  }

  if (coupon.minOrderValue && orderTotal < Number(coupon.minOrderValue)) {
    const symbol = coupon.currency?.symbol || (coupon.country?.code === "IN" ? "₹" : coupon.country?.code === "US" ? "$" : "");
    const formattedMin = symbol ? `${symbol}${Number(coupon.minOrderValue).toLocaleString()}` : `${coupon.minOrderValue}`;
    throw new AppError(`Minimum order value for this coupon is ${formattedMin}.`, 400);
  }

  let discount = coupon.discountType === "PERCENTAGE" ? (orderTotal * Number(coupon.discountValue)) / 100 : Number(coupon.discountValue);
  if (coupon.maxDiscount) discount = Math.min(discount, Number(coupon.maxDiscount));
  discount = Math.min(discount, orderTotal);

  const discountAmount = parseFloat(discount.toFixed(2));
  return {
    coupon: {
      ...coupon,
      effectiveStatus,
    },
    discount: discountAmount,
    public: {
      valid: true,
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: Number(coupon.discountValue),
      discountAmount,
      description: coupon.description,
    },
  };
}


