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

async function calculateCustomerOrder(
  customerId: string,
  input: CreateCustomerOrderInput,
) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId, deletedAt: null },
    include: { defaultCountry: true },
  });
  if (!customer) throw new AppError("Customer account not found.", 404);
  if (customer.status !== "ACTIVE")
    throw new AppError("Your customer account is inactive.", 401);
  if (customer.approvalStatus === "PENDING_APPROVAL") {
    throw new AppError(
      "Your account is pending approval. You will be notified once approved.",
      403,
    );
  }
  if (customer.approvalStatus === "SUSPENDED") {
    throw new AppError(
      "Your account has been suspended. Please contact support.",
      403,
    );
  }

  const requestedVariantIds = [
    ...new Set(input.items.map((item) => item.variantId)),
  ];
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

  const firstProductDefaultCountry =
    variants[0]?.product.defaultCountry ?? null;
  const orderCountry =
    explicitCountry ?? customer.defaultCountry ?? firstProductDefaultCountry;
  if (!orderCountry) {
    throw new AppError(
      "No default country is configured for this customer or product.",
      400,
    );
  }
  if (orderCountry.status !== "ACTIVE") {
    throw new AppError("Selected shipping country is inactive.", 400);
  }

  const variantMap = new Map(variants.map((variant) => [variant.id, variant]));
  const orderItems = await Promise.all(
    input.items.map(async (item) => {
      const variant = variantMap.get(item.variantId);
      if (!variant)
        throw new AppError(
          "One or more cart items are no longer available.",
          400,
        );

      const stockRecord =
        variant.inventories.find(
          (inventory) => inventory.countryId === orderCountry.id,
        ) ??
        variant.inventories.find((inventory) => inventory.countryId === null);
      const availableStock = Math.max(
        0,
        (stockRecord?.stock ?? 0) - (stockRecord?.reservedStock ?? 0),
      );
      if (availableStock < item.quantity) {
        throw new AppError(
          `Insufficient stock for ${variant.sku ?? variant.title}.`,
          400,
        );
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
        buyerState: input.shippingAddress?.state ?? null,
        sellerState: "Rajasthan",
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
    }),
  );

  const currencyId = orderItems[0]?.resolvedPrice.currency.id;
  if (!currencyId)
    throw new AppError("No currency could be resolved for this order.", 400);
  if (
    orderItems.some((item) => item.resolvedPrice.currency.id !== currencyId)
  ) {
    throw new AppError(
      "Cart items resolve to multiple currencies. Please place separate orders.",
      400,
    );
  }

  const subtotal = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
  const taxAmount = orderItems.reduce((sum, item) => sum + item.taxTotal, 0);
  const exclusiveTaxAmount = orderItems.reduce((sum, item) => {
    return item.resolvedPrice.taxMode === "EXCLUSIVE"
      ? sum + item.taxTotal
      : sum;
  }, 0);
  const shipping = await calculateRequiredShipping(orderCountry.code, subtotal);
  const shippingCharge = shipping.charge;
  const couponValidation = input.couponCode?.trim()
    ? await validateCoupon(input.couponCode, subtotal, orderCountry.code)
    : null;
  const discount = couponValidation?.discount ?? 0;
  const total = roundMoney(
    subtotal + exclusiveTaxAmount + shippingCharge - discount,
  );

  return {
    customer,
    orderCountry,
    currencyId,
    orderItems,
    subtotal,
    taxAmount,
    exclusiveTaxAmount,
    shipping,
    shippingCharge,
    discount,
    couponValidation,
    total,
  };
}

export async function estimateCustomerOrder(
  customerId: string,
  input: CreateCustomerOrderInput,
) {
  const calculation = await calculateCustomerOrder(customerId, input);

  const originalBaseSubtotal = roundMoney(
    calculation.orderItems.reduce(
      (sum, item) => sum + item.resolvedPrice.basePrice * item.quantity,
      0,
    ),
  );

  const automaticDiscounts = calculation.orderItems.flatMap((item) =>
    item.resolvedPrice.appliedDiscounts
      .filter((entry) => entry.type !== "BASE_PRICE" && entry.type !== "TAX")
      .map((entry) => ({
        variantId: item.variant.id,
        sku: item.variant.sku,
        label: entry.label,
        discountRuleType: entry.discountRuleType,
        discountPercent: entry.discountPercent ?? null,
        fixedAmount: entry.fixedAmount ?? null,
        amountBefore: entry.amountBefore,
        amountAfter: entry.amountAfter,
        discountAmount: roundMoney(
          (entry.amountBefore - entry.amountAfter) * item.quantity,
        ),
        quantity: item.quantity,
      })),
  );

  const automaticDiscount = roundMoney(
    Math.max(0, originalBaseSubtotal - calculation.subtotal),
  );

  const hasVat = calculation.orderItems.some(
    (item) => item.resolvedPrice.taxBreakdownStructure?.taxType === "VAT",
  );
  const isExempt =
    calculation.taxAmount === 0 ||
    calculation.orderItems.every(
      (item) => item.resolvedPrice.taxBreakdownStructure?.taxType === "EXEMPT",
    );
  const taxLabel = isExempt ? "Tax Exempt" : hasVat ? "VAT" : "GST";

  const customerTaxBreakdown = [
    {
      taxLabel,
      totalTax: calculation.taxAmount,
      taxAmount: calculation.taxAmount,
      label: taxLabel,
    },
  ];

  const primaryTaxMode =
    calculation.orderItems[0]?.resolvedPrice.taxMode || "EXCLUSIVE";
  const isTaxInclusive = primaryTaxMode === "INCLUSIVE";

  return {
    originalBaseSubtotal,
    subtotal: calculation.subtotal,
    taxAmount: calculation.taxAmount,
    taxMode: primaryTaxMode,
    isTaxInclusive,
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
      basePrice: item.resolvedPrice.basePrice,
      unitPrice: item.unitPrice,
      lineSubtotal: item.total,
      appliedDiscounts: item.resolvedPrice.appliedDiscounts.filter(
        (entry) => entry.type !== "BASE_PRICE" && entry.type !== "TAX",
      ),
      appliedTaxes: item.resolvedPrice.appliedDiscounts
        .filter((entry) => entry.type === "TAX")
        .map((entry) => ({
          label: taxLabel,
          taxPercent: entry.taxPercent,
          taxAmount: entry.taxAmount,
          isSpecific: !!entry.isSpecific,
        })),
    })),
    total: calculation.total,
    currency: calculation.orderItems[0]?.resolvedPrice.currency,
    taxBreakdown: customerTaxBreakdown,
  };
}

export async function createCustomerOrder(
  customerId: string,
  input: CreateCustomerOrderInput,
) {
  const {
    customer,
    orderCountry,
    currencyId,
    orderItems,
    subtotal,
    taxAmount,
    shipping,
    shippingCharge,
    discount,
    couponValidation,
    total,
  } = await calculateCustomerOrder(customerId, input);

  const resolvedTaxType =
    orderItems[0]?.resolvedPrice.taxBreakdownStructure?.taxType ||
    (taxAmount === 0 ? "EXEMPT" : "IGST");

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
        taxType: resolvedTaxType,
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
        {
          reason: "customer_order",
          adjustedBy: `customer:${customer.id};order:${order.id}`,
        },
        tx,
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
  const customer = await prisma.customer.findUnique({
    where: { id: customerId, deletedAt: null },
  });
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

export async function assertCustomerInvoiceAccess(
  customerId: string,
  orderId: string,
) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, customerId },
    select: { id: true, status: true, paymentStatus: true },
  });
  if (!order) throw new AppError("Order not found.", 404);
  const invoiceStatuses = new Set([
    "CONFIRMED",
    "PROCESSING",
    "SHIPPED",
    "DELIVERED",
  ]);
  if (!invoiceStatuses.has(order.status) && order.paymentStatus !== "PAID") {
    throw new AppError(
      "Invoice is available after the order is confirmed or paid.",
      400,
    );
  }
  return order;
}

export async function createRazorpayOrder(customerId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, customerId },
    include: { currency: true, country: true },
  });
  if (!order) throw new AppError("Order not found.", 404);
  if (order.paymentStatus === "PAID")
    throw new AppError("Order is already paid.", 400);

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret)
    throw new AppError("Razorpay credentials are not configured.", 500);

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Razorpay = require("razorpay");
  const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });
  const amountInPaise = Math.round(Number(order.total) * 100);

  try {
    const rzpOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: order.currency?.code ?? "INR",
      receipt: order.orderNumber,
      notes: { orderId: order.id, customerId },
    });

    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentId: rzpOrder.id,
        paymentMethod: "RAZORPAY",
      },
    });

    return {
      razorpayOrderId: rzpOrder.id,
      amount: amountInPaise,
      currency: rzpOrder.currency,
      keyId,
      orderNumber: order.orderNumber,
    };
  } catch (error) {
    console.error("========== RAZORPAY ERROR ==========");
    console.error(error);
    console.error("====================================");
    throw error;
  }
}

export async function verifyRazorpayPayment(
  customerId: string,
  orderId: string,
  payload: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  },
) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, customerId },
  });
  if (!order) throw new AppError("Order not found.", 404);

  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret)
    throw new AppError("Razorpay credentials are not configured.", 500);

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require("crypto");
  const body = `${payload.razorpay_order_id}|${payload.razorpay_payment_id}`;
  const expectedSignature = crypto
    .createHmac("sha256", keySecret)
    .update(body)
    .digest("hex");

  if (expectedSignature !== payload.razorpay_signature) {
    await prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: "FAILED" },
    });
    throw new AppError("Invalid payment signature verification failed.", 400);
  }

  const updatedOrder = await prisma.order.update({
    where: { id: order.id },
    data: {
      paymentStatus: "PAID",
      status: "PROCESSING",
      paymentMethod: "RAZORPAY",
      paymentId: payload.razorpay_payment_id,
    },
    include: {
      items: { include: { product: true, variant: true } },
      country: true,
      currency: true,
    },
  });

  return updatedOrder;
}
