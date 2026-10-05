import { prisma } from "../../config/database";
import { AppError } from "../../utils/apiResponse";
import { PaymentGatewayRegistry } from "./paymentGatewayRegistry";
import { resolveCartPaymentMethods } from "./paymentOverrides.service";
import { expireOrderAndReleaseStock } from "./paymentReconciliation.service";

export async function getAvailablePaymentMethodsForCountry(countryCode?: string) {
  const rawCountry = (countryCode || "IN").trim();

  const country = await prisma.country.findFirst({
    where: {
      status: "ACTIVE",
      OR: [
        { code: { equals: rawCountry, mode: "insensitive" } },
        { name: { equals: rawCountry, mode: "insensitive" } },
        { id: rawCountry },
      ],
    },
  });

  if (!country) {
    // Fallback to active payment methods enabled globally
    const methods = await prisma.paymentMethod.findMany({
      where: { isEnabled: true },
      orderBy: { sortOrder: "asc" },
    });
    return methods.map((m) => ({
      id: m.id,
      code: m.code,
      name: m.name,
      description: m.description,
      iconUrl: m.iconUrl,
      type: m.type,
      clientScriptUrl: m.clientScriptUrl,
      sortOrder: m.sortOrder,
      isDefault: m.code === "COD",
    }));
  }

  const mappings = await prisma.paymentMethodCountry.findMany({
    where: {
      countryId: country.id,
      isEnabled: true,
      paymentMethod: { isEnabled: true },
    },
    include: {
      paymentMethod: {
        include: {
          configs: {
            where: { isPublic: true },
          },
        },
      },
    },
    orderBy: { sortOrder: "asc" },
  });

  return mappings.map((mapping) => {
    const pm = mapping.paymentMethod;
    const publicKeyConfig = pm.configs.find((c) => c.isPublic);
    return {
      id: pm.id,
      code: pm.code,
      name: pm.name,
      description: pm.description,
      iconUrl: pm.iconUrl,
      type: pm.type,
      clientScriptUrl: pm.clientScriptUrl,
      sortOrder: mapping.sortOrder || pm.sortOrder,
      isDefault: mapping.isDefault,
      minOrderAmount: mapping.minOrderAmount ? Number(mapping.minOrderAmount) : null,
      maxOrderAmount: mapping.maxOrderAmount ? Number(mapping.maxOrderAmount) : null,
      publicKey: publicKeyConfig?.configValue ?? null,
    };
  });
}

export async function getAdminPaymentMatrix() {
  const [paymentMethods, countries, mappings] = await Promise.all([
    prisma.paymentMethod.findMany({
      orderBy: { sortOrder: "asc" },
      include: { configs: true },
    }),
    prisma.country.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
    }),
    prisma.paymentMethodCountry.findMany(),
  ]);

  const mappingMap = new Map<string, boolean>();
  mappings.forEach((m) => {
    mappingMap.set(`${m.paymentMethodId}:${m.countryId}`, m.isEnabled);
  });

  const matrix = countries.map((country) => {
    const methods = paymentMethods.map((pm) => ({
      id: pm.id,
      code: pm.code,
      name: pm.name,
      type: pm.type,
      isEnabled: mappingMap.get(`${pm.id}:${country.id}`) ?? (pm.code === "COD"),
    }));
    return {
      countryId: country.id,
      countryName: country.name,
      countryCode: country.code,
      methods,
    };
  });

  return {
    paymentMethods: paymentMethods.map((pm) => ({
      id: pm.id,
      code: pm.code,
      name: pm.name,
      description: pm.description,
      type: pm.type,
      isEnabled: pm.isEnabled,
      clientScriptUrl: pm.clientScriptUrl,
    })),
    matrix,
  };
}

export async function updateAdminPaymentMethodCountry(
  paymentMethodId: string,
  countryId: string,
  isEnabled: boolean,
) {
  const mapping = await prisma.paymentMethodCountry.upsert({
    where: {
      paymentMethodId_countryId: {
        paymentMethodId,
        countryId,
      },
    },
    update: { isEnabled },
    create: {
      paymentMethodId,
      countryId,
      isEnabled,
    },
  });

  if (isEnabled) {
    await prisma.paymentMethod.update({
      where: { id: paymentMethodId },
      data: { isEnabled: true },
    });
  }

  return mapping;
}

export async function updateAdminPaymentMethodGlobal(
  paymentMethodId: string,
  isEnabled: boolean,
  applyToAllCountries: boolean = true,
) {
  const pm = await prisma.paymentMethod.update({
    where: { id: paymentMethodId },
    data: { isEnabled },
  });

  if (applyToAllCountries) {
    const countries = await prisma.country.findMany({
      where: { status: "ACTIVE" },
      select: { id: true },
    });

    await prisma.$transaction(
      countries.map((c) =>
        prisma.paymentMethodCountry.upsert({
          where: {
            paymentMethodId_countryId: {
              paymentMethodId,
              countryId: c.id,
            },
          },
          update: { isEnabled },
          create: {
            paymentMethodId,
            countryId: c.id,
            isEnabled,
          },
        })
      )
    );
  }

  // Keep System Configuration settings in sync
  if (pm.code === "RAZORPAY") {
    await prisma.setting.upsert({
      where: { key: "payment.razorpay_enabled" },
      update: { value: isEnabled ? "true" : "false" },
      create: {
        key: "payment.razorpay_enabled",
        value: isEnabled ? "true" : "false",
        group: "payment",
        label: "Razorpay Enabled",
        type: "boolean",
        isSecret: false,
        isEnabled: true,
      },
    });
  } else if (pm.code === "STRIPE") {
    await prisma.setting.upsert({
      where: { key: "payment.stripe_enabled" },
      update: { value: isEnabled ? "true" : "false" },
      create: {
        key: "payment.stripe_enabled",
        value: isEnabled ? "true" : "false",
        group: "payment",
        label: "Stripe Enabled",
        type: "boolean",
        isSecret: false,
        isEnabled: true,
      },
    });
  } else if (pm.code === "CASHFREE") {
    await prisma.setting.upsert({
      where: { key: "payment.cashfree_enabled" },
      update: { value: isEnabled ? "true" : "false" },
      create: {
        key: "payment.cashfree_enabled",
        value: isEnabled ? "true" : "false",
        group: "payment",
        label: "Cashfree Enabled",
        type: "boolean",
        isSecret: false,
        isEnabled: true,
      },
    });
  }

  return pm;
}

export async function initiatePaymentForOrder(
  customerId: string,
  orderId: string,
  paymentMethodCode: string,
) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, customerId },
    include: {
      currency: true,
      country: true,
      items: { include: { product: true, variant: true } },
    },
  });

  if (!order) throw new AppError("Order not found.", 404);

  if (order.paymentStatus === "PAID") {
    throw new AppError("Order is already paid.", 400);
  }

  if (order.status === "CANCELLED") {
    throw new AppError("Order has been cancelled.", 400);
  }

  // Lazy check expiry
  if (order.paymentExpiresAt && order.paymentExpiresAt < new Date()) {
    await expireOrderAndReleaseStock(order.id);
    throw new AppError("Payment window has expired. Reserved inventory has been released.", 400);
  }

  // Validate that the payment method is supported for all items in this order
  const cartItems = order.items
    .filter((item) => item.variant)
    .map((item) => ({
      productId: item.productId,
      variantId: item.variantId!,
    }));
  const allowedRes = await resolveCartPaymentMethods(
    order.country.code,
    cartItems
  );
  const allowedMethods = allowedRes.methods || [];
  const isAllowed = allowedMethods.some(
    (m) => m.code.toUpperCase() === paymentMethodCode.toUpperCase()
  );
  if (!isAllowed) {
    throw new AppError(
      "The selected payment method is not supported for one or more items in this order.",
      400
    );
  }

  const strategy = PaymentGatewayRegistry.get(paymentMethodCode);

  // Fetch configs from database if available
  const pm = await prisma.paymentMethod.findUnique({
    where: { code: paymentMethodCode.toUpperCase() },
    include: { configs: true },
  });

  if (!pm || !pm.isEnabled) {
    throw new AppError("The selected payment method is currently disabled.", 400);
  }

  const configMap: Record<string, string> = {};
  if (pm) {
    pm.configs.forEach((c) => {
      configMap[c.configKey] = c.configValue;
    });
  }

  // Record paymentMethodId on order
  if (pm) {
    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentMethodId: pm.id,
        paymentMethod: pm.code,
      },
    });
  }

  return strategy.initiatePayment(order, configMap);
}

export async function verifyPaymentForOrder(
  customerId: string,
  orderId: string,
  paymentMethodCode: string,
  payload: Record<string, unknown>,
) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, customerId },
    include: {
      currency: true,
      country: true,
      items: { include: { product: true, variant: true } },
    },
  });

  if (!order) throw new AppError("Order not found.", 404);

  const strategy = PaymentGatewayRegistry.get(paymentMethodCode);

  const pm = await prisma.paymentMethod.findUnique({
    where: { code: paymentMethodCode.toUpperCase() },
    include: { configs: true },
  });

  const configMap: Record<string, string> = {};
  if (pm) {
    pm.configs.forEach((c) => {
      configMap[c.configKey] = c.configValue;
    });
  }

  return strategy.verifyPayment(order, payload, configMap);
}
