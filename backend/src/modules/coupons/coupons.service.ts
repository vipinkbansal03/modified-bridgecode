import { prisma } from "../../config/database";
import { AppError, getPagination } from "../../utils/apiResponse";

export async function listCoupons(query: { page?: string; limit?: string }) {
  const { page, limit, skip } = getPagination(query);
  const [data, total] = await Promise.all([
    prisma.coupon.findMany({ skip, take: limit, orderBy: { createdAt: "desc" }, include: { country: true, currency: true } }),
    prisma.coupon.count(),
  ]);
  return { data, total, page, limit };
}
export const createCoupon = (data: object) => prisma.coupon.create({ data: data as never });
export const updateCoupon = (id: string, data: object) => prisma.coupon.update({ where: { id }, data: data as never });
export const deleteCoupon = (id: string) => prisma.coupon.delete({ where: { id } });

export async function validateCoupon(code: string, orderTotal: number, countryCode?: string) {
  const normalizedCode = code.trim().toUpperCase();
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
