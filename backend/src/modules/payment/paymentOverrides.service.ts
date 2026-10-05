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
    // Fallback to globally enabled active payment methods
    const methods = await prisma.paymentMethod.findMany({
      where: { isEnabled: true },
      orderBy: { sortOrder: "asc" },
    });
    return {
      methods: methods.map((m) => ({
        id: m.id,
        code: m.code,
        name: m.name,
        description: m.description,
        iconUrl: m.iconUrl,
        type: m.type,
        clientScriptUrl: m.clientScriptUrl,
        sortOrder: m.sortOrder,
        isDefault: m.code === "COD",
        minOrderAmount: null,
        maxOrderAmount: null,
        publicKey: null,
      })),
      hasConflict: false,
      conflictingVariantIds: [],
    };
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
    return {
      methods: baseMethods,
      hasConflict: false,
      conflictingVariantIds: [],
    };
  }

  // Fetch Overrides for products and variants in cart
  const rawProductKeys = Array.from(
    new Set(cartItems.map((item) => item?.productId).filter((id): id is string => typeof id === "string" && id !== ""))
  );
  const variantIds = Array.from(
    new Set(cartItems.map((item) => item?.variantId).filter((id): id is string => typeof id === "string" && id !== ""))
  );

  const [dbProducts, dbVariants] = await Promise.all([
    rawProductKeys.length > 0
      ? prisma.product.findMany({
          where: {
            OR: [
              { id: { in: rawProductKeys } },
              { slug: { in: rawProductKeys } },
            ],
          },
          select: { id: true, slug: true },
        })
      : [],
    variantIds.length > 0
      ? prisma.productVariant.findMany({
          where: { id: { in: variantIds } },
          select: { id: true, productId: true },
        })
      : [],
  ]);

  const productKeyToIdMap = new Map<string, string>();
  dbProducts.forEach((p) => {
    productKeyToIdMap.set(p.id, p.id);
    productKeyToIdMap.set(p.slug, p.id);
  });
  const variantToProductMap = new Map(dbVariants.map((v) => [v.id, v.productId]));

  const resolvedProductIds = Array.from(
    new Set([
      ...Array.from(productKeyToIdMap.values()),
      ...Array.from(variantToProductMap.values()),
    ])
  );

  const [productOverrides, variantOverrides] = await Promise.all([
    resolvedProductIds.length > 0
      ? prisma.productPaymentMethod.findMany({
          where: { productId: { in: resolvedProductIds } },
        })
      : [],
    variantIds.length > 0
      ? prisma.variantPaymentMethod.findMany({
          where: { variantId: { in: variantIds } },
        })
      : [],
  ]);

  // Compute allowed payment methods per item
  const getItemAllowedMethodIds = (item: CartItemInput): Set<string> => {
    const allowed = new Set<string>();
    if (!item) return allowed;

    for (const method of baseMethods) {
      // 1. Check Variant Override (highest specificity)
      if (item.variantId) {
        const vOverride = variantOverrides.find(
          (vo) => vo.variantId === item.variantId && vo.paymentMethodId === method.id
        );
        if (vOverride) {
          if (vOverride.state === "ALLOW") {
            allowed.add(method.id);
            continue;
          }
          if (vOverride.state === "BLOCK") {
            continue;
          }
        }
      }

      // 2. Check Product Override
      const effectiveProductId =
        productKeyToIdMap.get(item.productId) ||
        variantToProductMap.get(item.variantId) ||
        item.productId;

      if (effectiveProductId) {
        const pOverride = productOverrides.find(
          (po) => po.productId === effectiveProductId && po.paymentMethodId === method.id
        );
        if (pOverride) {
          if (pOverride.state === "ALLOW") {
            allowed.add(method.id);
            continue;
          }
          if (pOverride.state === "BLOCK") {
            continue;
          }
        }
      }

      // 3. Inherit Country Default (method is active in country configuration)
      allowed.add(method.id);
    }
    return allowed;
  };

  const itemAllowedMap = new Map<string, Set<string>>();
  cartItems.forEach((item) => {
    const itemKey = item?.variantId || item?.productId;
    if (itemKey) {
      if (!itemAllowedMap.has(itemKey)) {
        itemAllowedMap.set(itemKey, getItemAllowedMethodIds(item));
      }
    }
  });

  // Evaluate Resolution Chain using multi-item intersection
  const resolvedMethods = baseMethods.filter((method) => {
    return Array.from(itemAllowedMap.values()).every((set) => set.has(method.id));
  });

  const conflictingVariantIds: string[] = [];

  if (resolvedMethods.length === 0 && itemAllowedMap.size > 0) {
    const variantIdList = Array.from(itemAllowedMap.keys());

    for (const varId of variantIdList) {
      const itemSet = itemAllowedMap.get(varId);
      if (!itemSet) continue;
      if (itemSet.size === 0) {
        conflictingVariantIds.push(varId);
        continue;
      }

      const otherSets = variantIdList
        .filter((id) => id !== varId)
        .map((id) => itemAllowedMap.get(id)!)
        .filter(Boolean);

      if (otherSets.length > 0) {
        let otherIntersection = new Set(otherSets[0]);
        for (let i = 1; i < otherSets.length; i++) {
          otherIntersection = new Set(
            Array.from(otherIntersection).filter((mId) => otherSets[i].has(mId))
          );
        }

        const hasOverlap = Array.from(itemSet).some((mId) => otherIntersection.has(mId));
        if (!hasOverlap) {
          conflictingVariantIds.push(varId);
        }
      } else {
        conflictingVariantIds.push(varId);
      }
    }
  }

  return {
    methods: resolvedMethods,
    hasConflict: conflictingVariantIds.length > 0,
    conflictingVariantIds,
  };
}
