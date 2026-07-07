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
  if (!Number.isFinite(numberValue) || numberValue < 0) {
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
  const countryId = blankToNull(input.countryId) as string | null;
  const currencyId = blankToNull(input.currencyId) as string | null;
  const status = input.status ?? "ACTIVE";
  if (!["ACTIVE", "INACTIVE"].includes(status)) throw new AppError("Status must be ACTIVE or INACTIVE.", 400);

  await Promise.all([assertExists("country", countryId), assertExists("currency", currencyId)]);

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
    currencyId,
    status,
  };
}

export async function listCoupons(query: CouponListQuery) {
  const { page, limit, skip } = getPagination(query);
  const search = query.search?.trim();
  const status = query.status?.trim().toUpperCase();
  if (status && !["ACTIVE", "INACTIVE"].includes(status)) {
    throw new AppError("Invalid coupon status.", 400);
  }

  const where: Prisma.CouponWhereInput = {
    ...(status ? { status: status as Status } : {}),
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
      include: { country: true, currency: true },
    }),
    prisma.coupon.count({ where }),
  ]);

  return { data, total, page, limit };
}

export async function createCoupon(input: CouponInput) {
  const data = await normalizeCouponInput(input);
  return prisma.coupon.create({
    data: data as Prisma.CouponUncheckedCreateInput,
    include: { country: true, currency: true },
  });
}

export async function updateCoupon(id: string, input: CouponInput) {
  const current = await prisma.coupon.findUnique({ where: { id } });
  if (!current) throw new AppError("Coupon not found.", 404);

  const data = await normalizeCouponInput({ ...current, ...input }, id);
  return prisma.coupon.update({
    where: { id },
    data: data as Prisma.CouponUncheckedUpdateInput,
    include: { country: true, currency: true },
  });
}

export const deleteCoupon = (id: string) => prisma.coupon.delete({ where: { id } });

export async function validateCoupon(code: string, orderTotal: number, countryCode?: string) {
  const normalizedCode = code.trim().toUpperCase();
  if (!normalizedCode) throw new AppError("Coupon code is required.", 400);
  if (!Number.isFinite(orderTotal) || orderTotal <= 0) throw new AppError("Order value must be greater than 0.", 400);

  const coupon = await prisma.coupon.findUnique({ where: { code: normalizedCode }, include: { country: true } });
  if (!coupon) throw new AppError("Coupon not found.", 404);
  if (coupon.status !== "ACTIVE") throw new AppError("Coupon is inactive.", 400);

  const now = new Date();
  if (coupon.startDate > now) throw new AppError("Coupon has not started yet.", 400);
  if (coupon.endDate < now) throw new AppError("Coupon has expired.", 400);
  if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) throw new AppError("Coupon usage limit reached.", 400);
  if (coupon.minOrderValue && orderTotal < Number(coupon.minOrderValue)) throw new AppError(`Minimum order value is ${coupon.minOrderValue}.`, 400);

  if (coupon.countryId) {
    if (!countryCode) throw new AppError("Coupon is available only for a specific country.", 400);
    if (coupon.country?.code !== countryCode.toUpperCase()) throw new AppError("Coupon is not available in your country.", 400);
  }

  let discount = coupon.discountType === "PERCENTAGE" ? (orderTotal * Number(coupon.discountValue)) / 100 : Number(coupon.discountValue);
  if (coupon.maxDiscount) discount = Math.min(discount, Number(coupon.maxDiscount));
  discount = Math.min(discount, orderTotal);

  const discountAmount = parseFloat(discount.toFixed(2));
  return {
    coupon,
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
