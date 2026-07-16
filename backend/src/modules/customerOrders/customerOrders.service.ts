import { prisma } from "../../config/database";
import { AppError } from "../../utils/apiResponse";
import { decrementVariantStock } from "../inventory/inventory.service";
import { assertSellableInCountry } from "../countries/countryAvailability.service";
import { resolvePrice } from "../pricing/priceResolver.service";
import { calculateRequiredShipping } from "../shipping/shipping.service";
import { validateCoupon } from "../coupons/coupons.service";
import type { CreateCustomerOrderInput } from "./customerOrders.validation";

function generateOrderNumber() {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ORD-${Date.now()}-${suffix}`;
}

const CUSTOMER_CHECKOUT_PAYMENT_METHOD = "PAY_ON_DELIVERY";

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

async function calculateCustomerOrder(customerId: string, input: CreateCustomerOrderInput) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId, deletedAt: null },
    include: { defaultCountry: true },
  });
  if (!customer) throw new AppError("Customer account not found.", 404);
  if (customer.status !== "ACTIVE") throw new AppError("Your customer account is inactive.", 401);
  if (customer.approvalStatus === "PENDING_APPROVAL") {
    throw new AppError("Your account is pending approval. You will be notified once approved.", 403);
  }
  if (customer.approvalStatus === "SUSPENDED") {
    throw new AppError("Your account has been suspended. Please contact support.", 403);
  }

  const requestedVariantIds = [...new Set(input.items.map((item) => item.variantId))];
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: requestedVariantIds }, status: "ACTIVE" },
    include: {
      product: {
        include: {
          defaultCountry: true,
          defaultCurrency: true,
        },
      },
      inventories: true,
    },
  });

  if (variants.length !== requestedVariantIds.length) {
    throw new AppError("One or more cart items are no longer available.", 400);
  }

  const explicitCountry = input.shippingAddress.countryCode
    ? await prisma.country.findUnique({
        where: { code: input.shippingAddress.countryCode.toUpperCase() },
        include: { currency: true },
      })
    : null;

  if (input.shippingAddress.countryCode && !explicitCountry) {
    throw new AppError("Selected shipping country is not available.", 400);
  }

  const firstProductDefaultCountry = variants[0]?.product.defaultCountry ?? null;
  const orderCountry = explicitCountry ?? customer.defaultCountry ?? firstProductDefaultCountry;
  if (!orderCountry) {
    throw new AppError("No default country is configured for this customer or product.", 400);
  }
  if (orderCountry.status !== "ACTIVE") {
    throw new AppError("Selected shipping country is inactive.", 400);
  }

  const variantMap = new Map(variants.map((variant) => [variant.id, variant]));
  const orderItems = await Promise.all(input.items.map(async (item) => {
    const variant = variantMap.get(item.variantId);
    if (!variant) throw new AppError("One or more cart items are no longer available.", 400);

    const stockRecord = variant.inventories.find((inventory) => inventory.countryId === orderCountry.id) ?? variant.inventories.find((inventory) => inventory.countryId === null);
    const availableStock = Math.max(0, (stockRecord?.stock ?? 0) - (stockRecord?.reservedStock ?? 0));
    if (availableStock < item.quantity) {
      throw new AppError(`Insufficient stock for ${variant.sku ?? variant.title}.`, 400);
    }

    const itemCountryId = orderCountry.id ?? variant.product.defaultCountryId;
    await assertSellableInCountry({
      countryId: itemCountryId,
      productId: variant.productId,
      variantId: variant.id,
    });
    const resolvedPrice = await resolvePrice({
      productId: variant.productId,
      variantId: variant.id,
      countryId: itemCountryId,
      customerId: customer.id,
      quantity: item.quantity,
    });

    const unitPrice = resolvedPrice.finalPrice;
    const unitPriceBeforeTax = resolvedPrice.priceBeforeTax;
    const unitTax = resolvedPrice.taxAmount;
    return {
      variant,
      resolvedPrice,
      quantity: item.quantity,
      unitPrice,
      unitPriceBeforeTax,
      unitTax,
      total: unitPrice * item.quantity,
      subtotal: unitPriceBeforeTax * item.quantity,
      taxTotal: unitTax * item.quantity,
    };
  }));

  const currencyId = orderItems[0]?.resolvedPrice.currency.id;
  if (!currencyId) throw new AppError("No currency could be resolved for this order.", 400);
  if (orderItems.some((item) => item.resolvedPrice.currency.id !== currencyId)) {
    throw new AppError("Cart items resolve to multiple currencies. Please place separate orders.", 400);
  }

  const subtotal = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
  const taxAmount = orderItems.reduce((sum, item) => sum + item.taxTotal, 0);
  const shipping = await calculateRequiredShipping(orderCountry.code, subtotal);
  const shippingCharge = shipping.charge;
  const couponValidation = input.couponCode?.trim()
    ? await validateCoupon(input.couponCode, subtotal, orderCountry.code)
    : null;
  const discount = couponValidation?.discount ?? 0;
  const total = subtotal + taxAmount + shippingCharge - discount;

  return { customer, orderCountry, currencyId, orderItems, subtotal, taxAmount, shipping, shippingCharge, discount, couponValidation, total };
}

export async function estimateCustomerOrder(customerId: string, input: CreateCustomerOrderInput) {
  const calculation = await calculateCustomerOrder(customerId, input);
  const automaticDiscounts = calculation.orderItems.flatMap((item) =>
    item.resolvedPrice.appliedDiscounts
      .filter((entry) => entry.type === "PROMOTIONAL_DISCOUNT")
      .map((entry) => ({
        variantId: item.variant.id,
        sku: item.variant.sku,
        label: entry.label,
        discountRuleType: entry.discountRuleType,
        discountPercent: entry.discountPercent ?? null,
        fixedAmount: entry.fixedAmount ?? null,
        amountBefore: entry.amountBefore,
        amountAfter: entry.amountAfter,
        discountAmount: roundMoney((entry.amountBefore - entry.amountAfter) * item.quantity),
        quantity: item.quantity,
      })),
  );
  const automaticDiscount = roundMoney(automaticDiscounts.reduce((sum, entry) => sum + entry.discountAmount, 0));
  const taxBreakdown = calculation.orderItems.reduce((layers, item) => {
    for (const layer of item.resolvedPrice.appliedDiscounts.filter((entry) => entry.type === "TAX")) {
      const key = `${layer.label}:${layer.taxPercent ?? ""}`;
      const existing = layers.get(key) ?? { label: layer.label, taxPercent: layer.taxPercent, taxAmount: 0 };
      existing.taxAmount += (layer.taxAmount ?? 0) * item.quantity;
      layers.set(key, existing);
    }
    return layers;
  }, new Map<string, { label: string; taxPercent?: number | null; taxAmount: number }>());

  return {
    subtotal: calculation.subtotal,
    taxAmount: calculation.taxAmount,
    shippingCharge: calculation.shippingCharge,
    shippingProvider: calculation.shipping.provider,
    shippingZoneId: calculation.shipping.zoneId,
    shippingEstimatedDays: calculation.shipping.estimatedDays,
    shippingIsFree: calculation.shipping.isFree,
    discount: calculation.discount,
    couponCode: calculation.couponValidation?.coupon.code ?? null,
    couponDiscount: calculation.discount,
    automaticDiscount,
    automaticDiscounts,
    items: calculation.orderItems.map((item) => ({
      variantId: item.variant.id,
      sku: item.variant.sku,
      title: item.variant.title,
      quantity: item.quantity,
      unitPrice: item.unitPriceBeforeTax,
      lineSubtotal: item.subtotal,
      appliedDiscounts: item.resolvedPrice.appliedDiscounts.filter((entry) => entry.type === "PROMOTIONAL_DISCOUNT"),
      appliedTaxes: item.resolvedPrice.appliedDiscounts
        .filter((entry) => entry.type === "TAX")
        .map((entry) => ({
          label: entry.label,
          taxPercent: entry.taxPercent,
          taxAmount: entry.taxAmount,
          isSpecific: !!entry.isSpecific,
        })),
    })),
    total: calculation.total,
    currency: calculation.orderItems[0]?.resolvedPrice.currency,
    taxBreakdown: Array.from(taxBreakdown.values()),
  };
}

export async function createCustomerOrder(customerId: string, input: CreateCustomerOrderInput) {
  const { customer, orderCountry, currencyId, orderItems, subtotal, taxAmount, shipping, shippingCharge, discount, couponValidation, total } =
    await calculateCustomerOrder(customerId, input);

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        customerName: `${customer.firstName} ${customer.lastName}`.trim(),
        customerEmail: customer.email,
        customerId: customer.id,
        customerPhone: customer.phone ?? input.shippingAddress.phone,
        shippingAddress: input.shippingAddress,
        countryId: orderCountry.id,
        currencyId,
        subtotal,
        discount,
        shippingCharge,
        taxAmount,
        total,
        couponId: couponValidation?.coupon.id ?? null,
        couponCode: couponValidation?.coupon.code ?? null,
        couponDiscount: discount,
        status: "PENDING",
        paymentStatus: "PENDING",
        paymentMethod: CUSTOMER_CHECKOUT_PAYMENT_METHOD,
        shippingProvider: shipping.provider,
        shippingZoneId: shipping.zoneId,
        notes: input.notes,
        items: {
          create: orderItems.map((item) => ({
            productId: item.variant.productId,
            variantId: item.variant.id,
            title: item.variant.title,
            sku: item.variant.sku,
            quantity: item.quantity,
            unitPrice: item.unitPriceBeforeTax,
            total: item.subtotal,
          })),
        },
      },
      include: {
        items: { include: { product: true, variant: true } },
        country: true,
        currency: true,
        shippingZone: { include: { provider: true, country: true } },
      },
    });

    for (const item of orderItems) {
      await decrementVariantStock(
        item.variant.id,
        item.quantity,
        order.countryId,
        { reason: "customer_order", adjustedBy: `customer:${customer.id};order:${order.id}` },
        tx
      );
    }

    if (couponValidation) {
      await tx.coupon.update({
        where: { id: couponValidation.coupon.id },
        data: { usedCount: { increment: 1 } },
      });
    }

    return order;
  });
}

export async function listCustomerOrders(customerId: string) {
  const customer = await prisma.customer.findUnique({ where: { id: customerId, deletedAt: null } });
  if (!customer) throw new AppError("Customer account not found.", 404);

  return prisma.order.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: "desc" },
    include: {
      items: { include: { product: true, variant: true } },
      country: true,
      currency: true,
      shippingZone: { include: { provider: true, country: true } },
    },
  });
}

export async function assertCustomerInvoiceAccess(customerId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, customerId },
    select: { id: true, status: true, paymentStatus: true },
  });
  if (!order) throw new AppError("Order not found.", 404);
  const invoiceStatuses = new Set(["CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"]);
  if (!invoiceStatuses.has(order.status) && order.paymentStatus !== "PAID") {
    throw new AppError("Invoice is available after the order is confirmed or paid.", 400);
  }
  return order;
}
