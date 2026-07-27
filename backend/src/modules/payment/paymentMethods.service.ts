import { prisma } from "../../config/database";
import { AppError } from "../../utils/apiResponse";
import { PaymentGatewayRegistry } from "./paymentGatewayRegistry";

export async function getAvailablePaymentMethodsForCountry(countryCode?: string) {
  const code = (countryCode || "IN").trim().toUpperCase();

  const country = await prisma.country.findFirst({
    where: { code, status: "ACTIVE" },
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

  return mapping;
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

  const strategy = PaymentGatewayRegistry.get(paymentMethodCode);

  // Fetch configs from database if available
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
