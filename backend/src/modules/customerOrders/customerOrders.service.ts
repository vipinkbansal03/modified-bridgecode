import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { AppError } from "../../utils/apiResponse";
import { sanitizeCustomerName } from "../../utils/nameValidation";
import { decrementVariantStock } from "../inventory/inventory.service";
import { reserveOrderInventory, releaseOrderReservation } from "../inventory/inventoryReservation.service";
import { assertSellableInCountry } from "../countries/countryAvailability.service";
import { resolvePrice } from "../pricing/priceResolver.service";
import { calculateRequiredShipping } from "../shipping/shipping.service";
import { calculateShipment } from "../shipping/shippingCalculator.service";
import { validateCoupon } from "../coupons/coupons.service";
import type { CreateCustomerOrderInput } from "./customerOrders.validation";
import { initiatePaymentForOrder, verifyPaymentForOrder } from "../payment/paymentMethods.service";
import { reconcilePaymentFailure, getPaymentSession } from "../payment/paymentReconciliation.service";
import { getSettingValue } from "../settings/settings.service";

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
    if (!item.variantId || item.variantId === item.productId || String(item.variantId).startsWith("base-")) {
      item.variantId = undefined;
    }
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
      where: { id: { in: requestedVariantIds }, status: "ACTIVE", deletedAt: null },
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
      .filter((entry) =>
        ["PROMOTIONAL_DISCOUNT", "MOQ_PRICE", "TIER_PRICE"].includes(entry.type),
      )
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
    items: calculation.orderItems.map((item) => {
      const basePriceLayer = item.resolvedPrice.appliedDiscounts.find(
        (d) => d.type === "BASE_PRICE",
      );
      const originalPrice = basePriceLayer
        ? basePriceLayer.amountAfter
        : item.resolvedPrice.basePrice;

      return {
        variantId: item.variant?.id ?? null,
        sku: item.variant?.sku ?? item.product.sku,
        title: item.variant?.title ?? item.product.title,
        quantity: item.quantity,
        basePrice: originalPrice,
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
      };
    }),
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
  const resolvedPaymentMethod = (input.paymentMethod || CUSTOMER_CHECKOUT_PAYMENT_METHOD).toUpperCase();
  const isCod = resolvedPaymentMethod === "PAY_ON_DELIVERY" || resolvedPaymentMethod === "COD";

  const orderNumber = generateOrderNumber();
  const globalAutoSetting = await getSettingValue("tax.auto_generate_invoice_global").catch(() => "");
  const isGlobalAuto = globalAutoSetting !== "false";
  const isAutoInvoice = isGlobalAuto && (orderCountry as any).autoGenerateInvoice !== false;

  const createdOrder = await prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: {
        orderNumber,
        customerName: sanitizeCustomerName(customer.firstName, customer.lastName) || customer.email,
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
        status: isCod ? "CONFIRMED" : "PENDING",
        paymentStatus: "PENDING",
        paymentMethod: isCod ? "PAY_ON_DELIVERY" : resolvedPaymentMethod,
        isInvoiceGenerated: isAutoInvoice,
        invoiceType: isAutoInvoice ? "AUTO" : "NONE",
        invoiceNumber: isAutoInvoice ? `INV-${orderNumber}` : null,
        invoiceDate: isAutoInvoice ? new Date() : null,
        paymentExpiresAt: isCod
          ? null
          : new Date(
              Date.now() +
                parseInt(process.env.ORDER_PAYMENT_RESERVATION_MINUTES || "15", 10) * 60 * 1000,
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
            title: item.product.title,
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

    notificationsService.dispatchNotification("ORDER_PLACED", {
      order_number: createdOrder.orderNumber,
      customer_name: createdOrder.customerName,
      currency: createdOrder.currency?.code || "INR",
      order_total: String(createdOrder.total),
      customerId: createdOrder.customerId || undefined,
      email: createdOrder.customerEmail,
      phone: createdOrder.customerPhone || undefined,
    }).catch(console.error);
  });

  await prisma.activityLog.create({
    data: {
      action: "ORDER_PLACED",
      entityType: "Order",
      entityId: createdOrder.id,
      metadata: { orderNumber: createdOrder.orderNumber, total: createdOrder.total },
    },
  }).catch(() => {});

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
      items: {
        include: {
          product: {
            include: {
              media: {
                orderBy: { sortOrder: "asc" },
              },
            },
          },
          variant: true,
        },
      },
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
  const result = await initiatePaymentForOrder(customerId, orderId, "RAZORPAY");
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  return {
    razorpayOrderId: result.paymentId,
    amount: (result.sdkPayload?.amount as number) || Math.round(Number(order.total) * 100),
    currency: (result.sdkPayload?.currency as string) || "INR",
    keyId: (result.sdkPayload?.key as string) || process.env.RAZORPAY_KEY_ID || "",
    orderNumber: order.orderNumber,
    sdkPayload: result.sdkPayload,
  };
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
  const result = await verifyPaymentForOrder(customerId, orderId, "RAZORPAY", payload);
  return result.order;
}

export async function recordClientPaymentFailure(
  customerId: string,
  orderId: string,
  payload: {
    gatewayOrderId?: string;
    errorCode?: string;
    errorMessage?: string;
  },
) {
  const result = await reconcilePaymentFailure({
    orderId,
    gatewayOrderId: payload.gatewayOrderId,
    errorCode: payload.errorCode,
    errorMessage: payload.errorMessage,
    provider: "RAZORPAY",
  });
  return result;
}

export async function getPaymentSessionForCustomer(customerId: string, orderId: string) {
  return getPaymentSession(customerId, orderId);
}

export async function releaseStock(orderId: string) {
  return releaseOrderReservation(orderId);
}

export interface CustomerTrackingItem {
  orderItemId: string;
  title: string;
  variantTitle: string | null;
  sku: string | null;
  quantity: number;
}

export interface CustomerTrackingEvent {
  id: string;
  status: import("@prisma/client").ShipmentStatus;
  statusLabel: string;
  location: string | null;
  description: string | null;
  timestamp: string;
}

export interface CustomerTrackingShipment {
  shipmentId: string;
  status: import("@prisma/client").ShipmentStatus;
  statusLabel: string;
  provider: {
    name: string;
    displayName: string;
  };
  trackingNumber: string | null;
  awbNumber: string | null;
  trackingUrl: string | null;
  labelUrl: string | null;
  estimatedDelivery: string | null;
  lastUpdatedAt: string;
  items: CustomerTrackingItem[];
  events: CustomerTrackingEvent[];
}

export interface CustomerOrderTrackingResponse {
  orderId: string;
  orderNumber: string;
  orderStatus: import("@prisma/client").OrderStatus;
  createdAt: string;
  isMultiShipment: boolean;
  shipments: CustomerTrackingShipment[];
  returns?: any[];
  paymentMethod?: string | null;
  paymentStatus?: string;
  isReturnable?: boolean;
  returnWindowDays?: number;
  deliveryDate?: string | null;
  cancelReason?: string | null;
  cancelRefundDetails?: string | null;
  cancelTransactionReference?: string | null;
}

export function getShipmentStatusLabel(status: import("@prisma/client").ShipmentStatus): string {
  switch (status) {
    case "CREATED":
      return "Order Confirmed";
    case "LABEL_GENERATED":
      return "Shipment Prepared";
    case "PICKED_UP":
      return "Picked Up";
    case "IN_TRANSIT":
      return "In Transit";
    case "OUT_FOR_DELIVERY":
      return "Out for Delivery";
    case "DELIVERED":
      return "Delivered";
    case "FAILED":
      return "Delivery Exception";
    case "RETURNED":
      return "Returned";
    case "CANCELLED":
      return "Cancelled";
    default:
      return String(status);
  }
}

export function buildTrackingUrl(
  templateUrl: string | null | undefined,
  trackingNumber: string | null | undefined,
  awbNumber: string | null | undefined
): string | null {
  const code = trackingNumber || awbNumber;
  if (!templateUrl || !code) return null;
  return templateUrl.replace(/\{tracking\}/gi, encodeURIComponent(code));
}

export async function getCustomerOrderTracking(
  customerId: string,
  orderId: string
): Promise<CustomerOrderTrackingResponse> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, customerId },
    include: {
      items: {
        include: {
          variant: true,
          product: true,
        },
      },
      returns: {
        include: {
          items: {
            include: {
              orderItem: true,
            },
          },
        },
      },
      shipments: {
        include: {
          provider: true,
          events: {
            orderBy: { timestamp: "asc" },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!order) {
    throw new AppError("Order not found.", 404);
  }

  // Simulation: Progress shipment status on each get tracking fetch for testing in local environment
  for (const shipment of order.shipments) {
    if (shipment.trackingNumber && shipment.status !== "DELIVERED" && shipment.status !== "CANCELLED" && shipment.status !== "FAILED") {
      let nextStatus: import("@prisma/client").ShipmentStatus | null = null;
      let eventDesc = "";
      let eventLoc = "";

      if (shipment.status === "CREATED") {
        nextStatus = "LABEL_GENERATED";
        eventDesc = "Shipment label generated and package is ready for pickup.";
        eventLoc = "Delhi Warehouse";
      } else if (shipment.status === "LABEL_GENERATED") {
        nextStatus = "PICKED_UP";
        eventDesc = "Package has been picked up by the courier partner.";
        eventLoc = "Delhi Hub";
      } else if (shipment.status === "PICKED_UP") {
        nextStatus = "IN_TRANSIT";
        eventDesc = "Shipment in transit. Arrived at the destination sorting facility.";
        eventLoc = "Jaipur Sorting Center";
      } else if (shipment.status === "IN_TRANSIT") {
        nextStatus = "OUT_FOR_DELIVERY";
        eventDesc = "Package is out for delivery with the courier agent.";
        eventLoc = "Jaipur Sector 5";
      } else if (shipment.status === "OUT_FOR_DELIVERY") {
        nextStatus = "DELIVERED";
        eventDesc = "Shipment delivered successfully. Signed by recipient.";
        eventLoc = "Jaipur Destination";
      }

      if (nextStatus) {
        await prisma.shipment.update({
          where: { id: shipment.id },
          data: { status: nextStatus },
        });

        const newEvent = await prisma.shipmentEvent.create({
          data: {
            shipmentId: shipment.id,
            status: nextStatus,
            location: eventLoc,
            description: eventDesc,
          },
        });

        if (nextStatus === "DELIVERED") {
          const nextPaymentStatus = order.paymentMethod === "PAY_ON_DELIVERY" ? "PAID" : undefined;
          await prisma.order.update({
            where: { id: order.id },
            data: { 
              status: "DELIVERED",
              ...(nextPaymentStatus && { paymentStatus: nextPaymentStatus }),
            },
          });
          order.status = "DELIVERED";
        }

        // Update in-memory objects to return the single new status and event immediately
        shipment.status = nextStatus;
        shipment.events.push(newEvent);
        
        break; // Only progress exactly ONE step per API call
      }
    }
  }

  const isMultiShipment = order.shipments.length > 1;

  const mappedShipments: CustomerTrackingShipment[] = order.shipments.map((shipment) => {
    let shipmentItems = order.items;
    if (isMultiShipment) {
      shipmentItems = order.items.filter((item) => {
        if (shipment.warehouseId) {
          return item.warehouseId === shipment.warehouseId;
        }
        return item.warehouseId === null;
      });
    }

    const items: CustomerTrackingItem[] = shipmentItems.map((item) => ({
      orderItemId: item.id,
      title: item.product?.title || item.title,
      variantTitle: item.variant?.title ?? (item.product?.title && item.title !== item.product.title ? item.title : null),
      sku: item.sku ?? item.variant?.sku ?? null,
      quantity: item.quantity,
    }));

    const events: CustomerTrackingEvent[] = shipment.events.map((e) => ({
      id: e.id,
      status: e.status,
      statusLabel: getShipmentStatusLabel(e.status),
      location: e.location ?? null,
      description: e.description ?? null,
      timestamp: e.timestamp.toISOString(),
    }));

    const trackingNumber = shipment.trackingNumber ?? null;
    const awbNumber = shipment.awbNumber ?? null;
    const trackingUrl = buildTrackingUrl(shipment.provider.trackingUrl, trackingNumber, awbNumber);

    const latestEvent = shipment.events.length > 0 ? shipment.events[shipment.events.length - 1] : null;
    const lastUpdatedAt = latestEvent
      ? latestEvent.timestamp.toISOString()
      : shipment.updatedAt.toISOString();

    return {
      shipmentId: shipment.id,
      status: shipment.status,
      statusLabel: getShipmentStatusLabel(shipment.status),
      provider: {
        name: shipment.provider.name,
        displayName: shipment.provider.displayName,
      },
      trackingNumber,
      awbNumber,
      trackingUrl,
      labelUrl: shipment.labelUrl ?? null,
      estimatedDelivery: shipment.estimatedDelivery ?? null,
      lastUpdatedAt,
      items,
      events,
    };
  });

  // Calculate delivery date
  const latestDeliveryEvent = await prisma.shipmentEvent.findFirst({
    where: {
      shipment: { orderId: order.id },
      status: "DELIVERED",
    },
    orderBy: { timestamp: "desc" },
  });
  const deliveryDate = latestDeliveryEvent?.timestamp || (order.status === "DELIVERED" || order.status === "RETURNED" ? order.updatedAt : null);

  // Fetch return window days setting
  const returnWindowSetting = await prisma.setting.findUnique({
    where: { key: "return_window_days" },
  });
  const returnWindowDays = returnWindowSetting ? parseInt(returnWindowSetting.value, 10) : 7;

  let isReturnable = false;
  if (order.status === "DELIVERED" || order.status === "RETURNED" || order.status === "RETURN_REQUESTED") {
    if (deliveryDate) {
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - deliveryDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays <= returnWindowDays) {
        // Check if there is any returnable quantity left
        let totalOrderedQty = order.items.reduce((sum, item) => sum + item.quantity, 0);
        let totalReturnedQty = order.returns
          .filter((ret) => ret.status !== "REJECTED" && ret.status !== ("CANCELLED" as any))
          .reduce((sum, ret) => {
            return sum + ret.items.reduce((itemSum, item) => itemSum + item.quantity, 0);
          }, 0);
        if (totalOrderedQty > totalReturnedQty) {
          isReturnable = true;
        }
      }
    }
  }

  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    orderStatus: order.status,
    createdAt: order.createdAt.toISOString(),
    isMultiShipment,
    shipments: mappedShipments,
    returns: order.returns,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    isReturnable,
    returnWindowDays,
    deliveryDate: deliveryDate ? deliveryDate.toISOString() : null,
    cancelReason: (order as any).cancelReason || null,
    cancelRefundDetails: (order as any).cancelRefundDetails || null,
    cancelTransactionReference: (order as any).cancelTransactionReference || null,
  };
}

export async function cancelCustomerOrder(
  customerId: string,
  orderId: string,
  input: { reason: string; refundDetails?: string }
) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
  });

  if (!order) throw new AppError("Order not found.", 404);
  if (order.customerId !== customerId) throw new AppError("Access denied.", 403);

  const cancellableStatuses = ["PENDING", "CONFIRMED", "PROCESSING"];
  if (!cancellableStatuses.includes(order.status)) {
    throw new AppError(`Order cannot be cancelled as it is already ${order.status.toLowerCase()}.`, 400);
  }

  if (order.paymentStatus === "PAID" && !input.refundDetails?.trim()) {
    throw new AppError("Refund details are required for prepaid orders.", 400);
  }

  await prisma.$transaction(async (tx) => {
    await releaseOrderReservation(orderId, tx);

    await tx.order.update({
      where: { id: orderId },
      data: {
        status: "CANCELLED",
        cancelReason: input.reason,
        cancelRefundDetails: input.refundDetails || null,
      } as any,
    });
  });

  import("../notifications/notifications.service").then(({ notificationsService }) => {
    notificationsService.createNotification({
      title: "Order Cancelled by Customer",
      message: `Customer cancelled order #${order.orderNumber}. Reason: ${input.reason}`,
      type: "ORDER",
      targetType: "ALL_ADMINS",
    }).catch(console.error);
  });

  return { success: true };
}


