import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { AppError } from "../../utils/apiResponse";
import { decrementVariantStock } from "../inventory/inventory.service";
import { reserveOrderInventory, releaseOrderReservation } from "../inventory/inventoryReservation.service";
import { assertSellableInCountry } from "../countries/countryAvailability.service";
import { resolvePrice } from "../pricing/priceResolver.service";
import { calculateRequiredShipping } from "../shipping/shipping.service";
import { calculateShipment } from "../shipping/shippingCalculator.service";
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

  input.items.forEach((item) => {
    if (item.variantId === item.productId) item.variantId = undefined;
    if (item.warehouseId === "default") item.warehouseId = undefined;
  });

  const requestedVariantIds = [
    ...new Set(input.items.map((item) => item.variantId).filter(Boolean) as string[]),
  ];
  const requestedProductIds = [
    ...new Set(input.items.map((item) => item.productId)),
  ];
  const [products, variants] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: requestedProductIds }, deletedAt: null },
      include: {
        defaultCountry: true,
        defaultCurrency: true,
        inventories: { include: { warehouse: true } },
      },
    }),
    prisma.productVariant.findMany({
      where: { id: { in: requestedVariantIds }, status: "ACTIVE" },
      include: {
        inventories: { include: { warehouse: true } },
      },
    }),
  ]);

  if (variants.length !== requestedVariantIds.length || products.length !== requestedProductIds.length) {
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
    products[0]?.defaultCountry ?? null;
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

  const productMap = new Map(products.map((p) => [p.id, p]));
  const variantMap = new Map(variants.map((v) => [v.id, v]));
  const orderItems = await Promise.all(
    input.items.map(async (item) => {
      const product = productMap.get(item.productId);
      const variant = item.variantId ? variantMap.get(item.variantId) : null;
      if (!product || (item.variantId && !variant))
        throw new AppError("One or more cart items are no longer available.", 400);

      const inventorySource = variant || product;
      const stockRecord = item.warehouseId
        ? inventorySource.inventories.find((inv) => inv.warehouseId === item.warehouseId && (!variant ? inv.variantId === null : true))
        : inventorySource.inventories.find((inv) => inv.warehouseId === null && (!variant ? inv.variantId === null : true));
      const availableStock = Math.max(0, (stockRecord?.stock ?? 0) - (stockRecord?.reservedStock ?? 0));
      const isOutOfStock = availableStock <= 0 || stockRecord?.status === "OUT_OF_STOCK";
      const displayName = variant ? `${product.title} - ${variant.title}` : product.title;

      if (isOutOfStock) {
        throw new AppError(`"${displayName}" is currently out of stock.`, 400);
      }
      if (availableStock < item.quantity) {
        throw new AppError(
          `Insufficient stock for "${displayName}". Only ${availableStock} unit${availableStock === 1 ? "" : "s"} available.`,
          400,
        );
      }

      const itemCountryId = orderCountry.id ?? product.defaultCountryId;
      await assertSellableInCountry({
        countryId: itemCountryId,
        productId: product.id,
        variantId: variant?.id ?? null,
      });
      const resolvedPrice = await resolvePrice({
        productId: product.id,
        variantId: variant?.id ?? null,
        countryId: itemCountryId,
        customerId: customer.id,
        quantity: item.quantity,
        buyerState: input.shippingAddress?.state ?? null,
        sellerState: stockRecord?.warehouse?.state ?? null,
      });

      if (resolvedPrice.finalPrice <= 0 || resolvedPrice.basePrice <= 0) {
        throw new AppError(
          `The item "${displayName}" is Price Upon Request for ${orderCountry.name} and cannot be purchased via standard checkout. Please submit a quote request instead.`,
          400,
        );
      }

      const unitPrice = resolvedPrice.finalPrice;
      const unitPriceBeforeTax = resolvedPrice.priceBeforeTax;
      const unitTax = resolvedPrice.taxAmount;
      return {
          product,
          variant,
        resolvedPrice,
        quantity: item.quantity,
        unitPrice,
        unitPriceBeforeTax,
        unitTax,
        total: unitPrice * item.quantity,
        subtotal: unitPriceBeforeTax * item.quantity,
        taxTotal: unitTax * item.quantity,
        warehouseId: stockRecord?.warehouseId ?? null,
        inventoryId: stockRecord?.id ?? null,
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
  const warehouseGroups = new Map<string | null, number>();
  for (const item of orderItems) {
    const current = warehouseGroups.get(item.warehouseId) || 0;
    warehouseGroups.set(item.warehouseId, current + item.subtotal);
  }

  let totalShippingCharge = 0;
  let primaryProvider: string | null = "Standard Shipping";
  let primaryZoneId: string | null | undefined = undefined;
  let isFree = true;
  let estimatedDays: string | null | undefined = null;
  
  const shipmentsData = [];
  
  for (const [whId, whSubtotal] of warehouseGroups.entries()) {
    const whShipping = await calculateRequiredShipping(orderCountry.code, whSubtotal, input.shippingZoneId);
    totalShippingCharge += whShipping.charge;
    if (!whShipping.isFree) isFree = false;
    primaryProvider = warehouseGroups.size > 1 ? "Multiple Shipments" : whShipping.provider;
    primaryZoneId = whShipping.zoneId;
    estimatedDays = whShipping.estimatedDays;
    
    shipmentsData.push({
      warehouseId: whId,
      shipping: whShipping
    });
  }

  const shipping = {
    provider: primaryProvider,
    providerId: shipmentsData[0]?.shipping.providerId,
    zoneId: primaryZoneId,
    estimatedDays: warehouseGroups.size > 1 ? "Varies by shipment" : estimatedDays,
    isFree: isFree,
    charge: totalShippingCharge,
    shipmentsData
  };
  const shippingCharge = shipping.charge;
  const packaging = await calculateShipment(
    orderItems.map((item) => ({
      productId: item.product.id,
      variantId: item.variant?.id ?? null,
      quantity: item.quantity,
    })),
    { countryCode: orderCountry.code },
  );
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
    packaging,
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

  const automaticDiscounts = calculation.orderItems.flatMap((item) =>
    item.resolvedPrice.appliedDiscounts
      .filter((entry) => entry.type === "PROMOTIONAL_DISCOUNT")
      .map((entry) => ({
        variantId: item.variant?.id ?? null,
        sku: item.variant?.sku ?? item.product.sku,
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
    automaticDiscounts.reduce((sum, d) => sum + d.discountAmount, 0)
  );

  const originalBaseSubtotal = roundMoney(calculation.subtotal + automaticDiscount);

  const hasVat = calculation.orderItems.some(
    (item) => item.resolvedPrice.taxBreakdownStructure?.taxType === "VAT",
  );
  const hasVatReverseCharge = calculation.orderItems.some(
    (item) =>
      item.resolvedPrice.taxBreakdownStructure?.taxType === "VAT" &&
      item.resolvedPrice.taxBreakdownStructure?.rate === 0,
  );
  const isExempt =
    calculation.orderItems.every(
      (item) => item.resolvedPrice.taxBreakdownStructure?.taxType === "EXEMPT",
    );
  const taxLabel = hasVatReverseCharge
    ? "VAT Reverse Charge"
    : isExempt
    ? "Tax Exempt"
    : hasVat
    ? "VAT"
    : "GST";

  let totalIgst = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalVat = 0;

  for (const item of calculation.orderItems) {
    const bd = item.resolvedPrice.taxBreakdownStructure;
    if (bd) {
      if (bd.taxType === "IGST") {
        totalIgst += (bd.igst || 0) * item.quantity;
      } else if (bd.taxType === "CGST_SGST") {
        totalCgst += (bd.cgst || 0) * item.quantity;
        totalSgst += (bd.sgst || 0) * item.quantity;
      } else if (bd.taxType === "VAT") {
        totalVat += (bd.vat || 0) * item.quantity;
      }
    }
  }

  const resolvedTaxType =
    calculation.orderItems[0]?.resolvedPrice.taxBreakdownStructure?.taxType ||
    (calculation.taxAmount === 0 ? "EXEMPT" : "IGST");
  const taxPercent = calculation.orderItems[0]?.resolvedPrice.taxBreakdownStructure?.rate || 0;

  const customerTaxBreakdown: Array<{ label: string; taxAmount: number; rate: number }> = [];
  if (resolvedTaxType === "CGST_SGST") {
    customerTaxBreakdown.push(
      { label: "CGST", taxAmount: roundMoney(totalCgst), rate: taxPercent / 2 },
      { label: "SGST", taxAmount: roundMoney(totalSgst), rate: taxPercent / 2 }
    );
  } else if (resolvedTaxType === "IGST" && calculation.taxAmount > 0) {
    customerTaxBreakdown.push({
      label: "IGST",
      taxAmount: roundMoney(totalIgst),
      rate: taxPercent,
    });
  } else if (resolvedTaxType === "VAT") {
    const label = hasVatReverseCharge ? "VAT Reverse Charge" : "VAT";
    customerTaxBreakdown.push({
      label,
      taxAmount: roundMoney(totalVat),
      rate: taxPercent,
    });
  }

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
    shipmentsCount: calculation.shipping.shipmentsData?.length || 1,
    shippingBox: calculation.packaging.box,
    packageWeight: calculation.packaging.totalWeight,
    packageVolume: calculation.packaging.totalVolume,
    discount: calculation.discount,
    couponCode: calculation.couponValidation?.coupon.code ?? null,
    couponDiscount: calculation.discount,
    automaticDiscount,
    automaticDiscounts,
    items: calculation.orderItems.map((item) => ({
      variantId: item.variant?.id ?? null,
      sku: item.variant?.sku ?? item.product.sku,
      title: item.variant?.title ?? item.product.title,
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
    packaging,
    discount,
    couponValidation,
    total,
  } = await calculateCustomerOrder(customerId, input);

  const resolvedTaxType =
    orderItems[0]?.resolvedPrice.taxBreakdownStructure?.taxType ||
    (taxAmount === 0 ? "EXEMPT" : "IGST");

  let totalIgst = 0;
  let totalCgst = 0;
  let totalSgst = 0;
  let totalVat = 0;
  let totalSalesTax = 0;
  let isZeroRated = false;

  for (const item of orderItems) {
    const bd = item.resolvedPrice.taxBreakdownStructure;
    if (bd) {
      if (bd.taxType === "IGST") {
        totalIgst += (bd.igst || 0) * item.quantity;
      } else if (bd.taxType === "CGST_SGST") {
        totalCgst += (bd.cgst || 0) * item.quantity;
        totalSgst += (bd.sgst || 0) * item.quantity;
      } else if (bd.taxType === "VAT") {
        totalVat += (bd.vat || 0) * item.quantity;
      }
    }
  }

  const destinationCountryCode = orderCountry.code?.toUpperCase() || "IN";
  if (destinationCountryCode !== "IN" && taxAmount === 0) {
    isZeroRated = true;
  }

  const hasVat = orderItems.some((item) => item.resolvedPrice.taxBreakdownStructure?.taxType === "VAT");
  const hasVatReverseCharge = orderItems.some(
    (item) =>
      item.resolvedPrice.taxBreakdownStructure?.taxType === "VAT" &&
      item.resolvedPrice.taxBreakdownStructure?.rate === 0,
  );
  const isExempt = orderItems.every((item) => item.resolvedPrice.taxBreakdownStructure?.taxType === "EXEMPT");
  const taxLabel = hasVatReverseCharge ? "VAT Reverse Charge" : isExempt ? "Tax Exempt" : hasVat ? "VAT" : "GST";
  const primaryTaxMode = orderItems[0]?.resolvedPrice.taxMode || "EXCLUSIVE";

  const createdOrder = await prisma.$transaction(async (tx) => {
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
        taxIdSnapshot: customer.taxIdStatus === "VALID" ? customer.taxId : null,
        taxIdTypeSnapshot: customer.taxIdStatus === "VALID" ? customer.taxIdType : null,
        taxMode: primaryTaxMode,
        taxLabel: taxLabel,
        igstAmount: totalIgst,
        cgstAmount: totalCgst,
        sgstAmount: totalSgst,
        vatAmount: totalVat,
        salesTaxAmount: totalSalesTax,
        isZeroRated: isZeroRated,
        total,
        couponId: couponValidation?.coupon.id ?? null,
        couponCode: couponValidation?.coupon.code ?? null,
        couponDiscount: discount,
        status: "PENDING",
        paymentStatus: "PENDING",
        paymentMethod: CUSTOMER_CHECKOUT_PAYMENT_METHOD,
        paymentExpiresAt: new Date(
          Date.now() +
            parseInt(process.env.ORDER_PAYMENT_RESERVATION_MINUTES || "4", 10) * 60 * 1000,
        ),
        shippingProvider: shipping.provider,
        shippingZoneId: shipping.zoneId,
        shippingBoxId: packaging.box?.id ?? null,
        shippingBoxName: packaging.box?.name ?? null,
        packageWeight: packaging.totalWeight,
        packageVolume: packaging.totalVolume,
        orderBoxes: {
          create: packaging.boxes.map((pack) => ({
            boxId: pack.boxId,
            boxName: pack.name,
            quantity: 1,
            weight: pack.weight,
            volume: pack.volume,
            items: pack.units as Prisma.InputJsonValue,
          })),
        },
        notes: input.notes,
        items: {
          create: orderItems.map((item) => ({
            productId: item.product.id,
            variantId: item.variant?.id ?? null,
            title: item.variant?.title ?? item.product.title,
            sku: item.variant?.sku ?? item.product.sku,
            quantity: item.quantity,
            unitPrice: item.unitPriceBeforeTax,
            total: item.subtotal,
            hsnCode: item.product.hsnCode,
            taxAmount: item.taxTotal,
            warehouseId: item.warehouseId,
          })),
        },
        shipments: {
          create: shipping.shipmentsData.map((shipmentData) => ({
            providerId: shipmentData.shipping.providerId!,
            warehouseId: shipmentData.warehouseId,
            shippingCharge: shipmentData.shipping.charge,
            status: "CREATED",
          })),
        },
      },
      include: {
        items: { include: { product: true, variant: true } },
        country: true,
        currency: true,
        shippingZone: { include: { provider: true, countries: { include: { country: true } } } },
        shippingBox: true,
        orderBoxes: true,
        shipments: true,
      },
    });

    // Reserve inventory for this pending order (physical stock stays unchanged)
    await reserveOrderInventory(order.id, tx);

    if (couponValidation) {
      await tx.coupon.update({
        where: { id: couponValidation.coupon.id },
        data: { usedCount: { increment: 1 } },
      });
    }

    return order;
  });

  // Notify Admins
  import("../notifications/notifications.service").then(({ notificationsService }) => {
    notificationsService.createNotification({
      title: "New Order Placed",
      message: `Order #${createdOrder.id} has been placed.`,
      type: "ORDER",
      targetType: "ALL_ADMINS",
      link: `/admin/orders/${createdOrder.id}`,
    }).catch(console.error);
  });

  return createdOrder;
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
      shippingZone: { include: { provider: true, countries: { include: { country: true } } } },
      shippingBox: true,
      orderBoxes: true,
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
  if (order.status === "CANCELLED") {
    throw new AppError(
      "Invoice is not available for cancelled orders.",
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

    // Record PaymentTransaction attempt
    await prisma.paymentTransaction.create({
      data: {
        orderId: order.id,
        paymentMethod: "RAZORPAY",
        provider: "RAZORPAY",
        gatewayOrderId: rzpOrder.id,
        status: "PENDING",
        amount: order.total,
        currency: rzpOrder.currency ?? order.currency?.code ?? "INR",
        metadata: { receipt: order.orderNumber },
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

    await prisma.paymentTransaction.updateMany({
      where: { gatewayOrderId: payload.razorpay_order_id },
      data: {
        status: "FAILED",
        errorMessage: "Invalid payment signature verification failed.",
      },
    });

    throw new AppError("Invalid payment signature verification failed.", 400);
  }

  // Update PaymentTransaction to SUCCESS
  await prisma.paymentTransaction.updateMany({
    where: { gatewayOrderId: payload.razorpay_order_id },
    data: {
      status: "SUCCESS",
      gatewayPaymentId: payload.razorpay_payment_id,
      gatewaySignature: payload.razorpay_signature,
    },
  });

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

export async function releaseStock(orderId: string) {
  return releaseOrderReservation(orderId);
}


