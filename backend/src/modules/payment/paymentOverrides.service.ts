import { prisma } from "../../config/database";
import { PaymentMethodOverrideState } from "@prisma/client";

export interface CartItemInput {
  productId: string;
  variantId: string;
}

export interface UpdateOverridesInput {
  productOverrides: {
    paymentMethodId: string;
    state: PaymentMethodOverrideState | null; // null represents INHERIT
  }[];
  variantOverrides: {
    variantId: string;
    paymentMethodId: string;
    state: PaymentMethodOverrideState | null; // null represents INHERIT
  }[];
}

/**
 * Retrieves override configurations for a given product and its variants.
 */
export async function getProductAndVariantOverrides(productId: string) {
  const [productOverrides, variants, availablePaymentMethods] = await Promise.all([
    prisma.productPaymentMethod.findMany({
      where: { productId },
    }),
    prisma.productVariant.findMany({
      where: { productId },
      include: {
        paymentMethods: true,
      },
    }),
    prisma.paymentMethod.findMany({
      where: { isEnabled: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const variantOverrides = variants.flatMap((v) =>
    v.paymentMethods.map((pm) => ({
      variantId: v.id,
      paymentMethodId: pm.paymentMethodId,
      state: pm.state,
    }))
  );

  return {
    productOverrides: productOverrides.map((po) => ({
      paymentMethodId: po.paymentMethodId,
      state: po.state,
    })),
    variantOverrides,
    availablePaymentMethods: availablePaymentMethods.map((pm) => ({
      id: pm.id,
      code: pm.code,
      name: pm.name,
    })),
  };
}

/**
 * Saves override configurations using a Prisma transaction and logs the activity.
 */
export async function updateProductAndVariantOverrides(
  productId: string,
  userId: string,
  data: UpdateOverridesInput
) {
  return await prisma.$transaction(async (tx) => {
    // 1. Process Product-level Overrides
    for (const po of data.productOverrides) {
      if (po.state === null) {
        // INHERIT: Delete explicit override record if it exists
        await tx.productPaymentMethod.deleteMany({
          where: {
            productId,
            paymentMethodId: po.paymentMethodId,
          },
        });
      } else {
        // ALLOW / BLOCK: Upsert record
        await tx.productPaymentMethod.upsert({
          where: {
            productId_paymentMethodId: {
              productId,
              paymentMethodId: po.paymentMethodId,
            },
          },
          update: { state: po.state },
          create: {
            productId,
            paymentMethodId: po.paymentMethodId,
            state: po.state,
          },
        });
      }
    }

    // 2. Process Variant-level Overrides
    for (const vo of data.variantOverrides) {
      if (vo.state === null) {
        // INHERIT: Delete explicit override record if it exists
        await tx.variantPaymentMethod.deleteMany({
          where: {
            variantId: vo.variantId,
            paymentMethodId: vo.paymentMethodId,
          },
        });
      } else {
        // ALLOW / BLOCK: Upsert record
        await tx.variantPaymentMethod.upsert({
          where: {
            variantId_paymentMethodId: {
              variantId: vo.variantId,
              paymentMethodId: vo.paymentMethodId,
            },
          },
          update: { state: vo.state },
          create: {
            variantId: vo.variantId,
            paymentMethodId: vo.paymentMethodId,
            state: vo.state,
          },
        });
      }
    }

    // 3. Create Audit Activity Log
    const log = await tx.activityLog.create({
      data: {
        userId,
        action: "PRODUCT_PAYMENT_OVERRIDES_UPDATED",
        entityType: "Product",
        entityId: productId,
        metadata: {
          productOverridesCount: data.productOverrides.length,
          variantOverridesCount: data.variantOverrides.length,
        },
      },
    });

    return { success: true, logId: log.id };
  });
}

/**
 * Resolves available payment methods based on checkout country and cart item overrides.
 */
export async function resolveCartPaymentMethods(
  countryCode: string,
  cartItems: CartItemInput[]
) {
  const code = (countryCode || "IN").trim().toUpperCase();

  const country = await prisma.country.findFirst({
    where: { code, status: "ACTIVE" },
  });

  if (!country) {
    return [];
  }

  // Fetch Country-level enabled methods
  const countryMappings = await prisma.paymentMethodCountry.findMany({
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

  const baseMethods = countryMappings.map((mapping) => {
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

  // If no items in cart, fallback to base country methods
  if (!cartItems || cartItems.length === 0) {
    return baseMethods;
  }

  // Fetch Overrides for products and variants in cart
  const productIds = Array.from(new Set(cartItems.map((item) => item.productId)));
  const variantIds = Array.from(new Set(cartItems.map((item) => item.variantId)));

  const [productOverrides, variantOverrides] = await Promise.all([
    prisma.productPaymentMethod.findMany({
      where: { productId: { in: productIds } },
    }),
    prisma.variantPaymentMethod.findMany({
      where: { variantId: { in: variantIds } },
    }),
  ]);

  // Evaluate Resolution Chain (Country -> Product -> Variant) using multi-item intersection
  const resolvedMethods = baseMethods.filter((method) => {
    for (const item of cartItems) {
      // 1. Check Variant Override (highest specificity)
      const vOverride = variantOverrides.find(
        (vo) => vo.variantId === item.variantId && vo.paymentMethodId === method.id
      );
      if (vOverride) {
        if (vOverride.state === "BLOCK") return false;
        if (vOverride.state === "ALLOW") continue;
      }

      // 2. Check Product Override
      const pOverride = productOverrides.find(
        (po) => po.productId === item.productId && po.paymentMethodId === method.id
      );
      if (pOverride) {
        if (pOverride.state === "BLOCK") return false;
        if (pOverride.state === "ALLOW") continue;
      }

      // 3. Inherit Country (already active in country configuration)
    }
    return true;
  });

  return resolvedMethods;
}
