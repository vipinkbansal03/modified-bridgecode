import { prisma } from "../../config/database";
import { AppError } from "../../utils/apiResponse";
import { decrementVariantStock } from "../inventory/inventory.service";
import { resolvePrice } from "../pricing/priceResolver.service";
import type { CreateCustomerOrderInput } from "./customerOrders.validation";

function generateOrderNumber() {
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ORD-${Date.now()}-${suffix}`;
}

const CUSTOMER_CHECKOUT_PAYMENT_METHOD = "PAY_ON_DELIVERY";
const CUSTOMER_CHECKOUT_SHIPPING_PROVIDER = "FREE_STANDARD";
const CUSTOMER_CHECKOUT_SHIPPING_CHARGE = 0;

export async function createCustomerOrder(customerId: string, input: CreateCustomerOrderInput) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId, deletedAt: null },
    include: { defaultCountry: true },
  });
  if (!customer) throw new AppError("Customer account not found.", 404);
  if (customer.status !== "ACTIVE") throw new AppError("Your customer account is inactive.", 401);

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
      inventory: true,
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

  const variantMap = new Map(variants.map((variant) => [variant.id, variant]));
  const orderItems = await Promise.all(input.items.map(async (item) => {
    const variant = variantMap.get(item.variantId);
    if (!variant) throw new AppError("One or more cart items are no longer available.", 400);

    const availableStock = Math.max(0, (variant.inventory?.stock ?? 0) - (variant.inventory?.reservedStock ?? 0));
    if (availableStock < item.quantity) {
      throw new AppError(`Insufficient stock for ${variant.sku ?? variant.title}.`, 400);
    }

    const itemCountryId = orderCountry.id ?? variant.product.defaultCountryId;
    const resolvedPrice = await resolvePrice({
      productId: variant.productId,
      variantId: variant.id,
      countryId: itemCountryId,
      customerId: customer.id,
      quantity: item.quantity,
    });

    const unitPrice = resolvedPrice.finalPrice;
    return {
      variant,
      resolvedPrice,
      quantity: item.quantity,
      unitPrice,
      total: unitPrice * item.quantity,
    };
  }));

  const currencyId = orderItems[0]?.resolvedPrice.currency.id;
  if (!currencyId) throw new AppError("No currency could be resolved for this order.", 400);
  if (orderItems.some((item) => item.resolvedPrice.currency.id !== currencyId)) {
    throw new AppError("Cart items resolve to multiple currencies. Please place separate orders.", 400);
  }

  const subtotal = orderItems.reduce((sum, item) => sum + item.total, 0);
  const shippingCharge = CUSTOMER_CHECKOUT_SHIPPING_CHARGE;
  const discount = 0;
  const total = subtotal + shippingCharge - discount;

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
        total,
        status: "PENDING",
        paymentStatus: "PENDING",
        paymentMethod: CUSTOMER_CHECKOUT_PAYMENT_METHOD,
        shippingProvider: CUSTOMER_CHECKOUT_SHIPPING_PROVIDER,
        notes: input.notes,
        items: {
          create: orderItems.map((item) => ({
            productId: item.variant.productId,
            variantId: item.variant.id,
            title: item.variant.title,
            sku: item.variant.sku,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
          })),
        },
      },
      include: {
        items: { include: { product: true, variant: true } },
        country: true,
        currency: true,
      },
    });

    for (const item of orderItems) {
      await decrementVariantStock(
        item.variant.id,
        item.quantity,
        { reason: "customer_order", adjustedBy: `customer:${customer.id};order:${order.id}` },
        tx
      );
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
    },
  });
}
