const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../src/modules/customerOrders/customerOrders.service.ts');
let content = fs.readFileSync(file, 'utf8');

const t1 = `  const variantMap = new Map(variants.map((variant) => [variant.id, variant]));
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
          \`Insufficient stock for \${variant.sku ?? variant.title}.\`,
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
        sellerState: null,
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
  );`;

const r1 = `  const variantMap = new Map(variants.map((variant) => [variant.id, variant]));
  
  // 1. Validate items and build item requirements
  const itemRequirements = input.items.map((item) => {
    const variant = variantMap.get(item.variantId);
    if (!variant) throw new AppError("One or more cart items are no longer available.", 400);
    return { item, variant };
  });

  // 2. Identify eligible warehouses that can fulfill the ENTIRE order
  const isIndia = orderCountry.code.toUpperCase() === "IN";
  const candidateWarehousesMap = new Map();

  for (const { variant } of itemRequirements) {
    for (const inv of variant.inventories) {
      if (inv.warehouse && inv.warehouse.countryId === orderCountry.id) {
        const wh = inv.warehouse;
        if (wh.status !== "ACTIVE") continue;
        if (isIndia && (!wh.gstin || wh.gstin.trim() === "")) continue;
        candidateWarehousesMap.set(wh.id, wh);
      }
    }
  }

  const candidateWarehouses = Array.from(candidateWarehousesMap.values());
  const eligibleWarehouses = candidateWarehouses.filter((wh) => {
    for (const { item, variant } of itemRequirements) {
      const inv = variant.inventories.find((i) => i.warehouseId === wh.id);
      if (!inv) return false;
      const available = Math.max(0, inv.stock - inv.reservedStock);
      if (available < item.quantity) return false;
    }
    return true;
  });

  if (eligibleWarehouses.length === 0) {
    throw new AppError(
      "We cannot fulfill all items in this cart from a single warehouse. Please adjust your quantities or split your order.",
      400
    );
  }

  const buyerState = input.shippingAddress?.state?.toLowerCase() || "";
  eligibleWarehouses.sort((a, b) => {
    const aMatch = (a.state || "").toLowerCase() === buyerState;
    const bMatch = (b.state || "").toLowerCase() === buyerState;
    if (aMatch && !bMatch) return -1;
    if (!aMatch && bMatch) return 1;
    return 0; 
  });

  const allocatedWarehouse = eligibleWarehouses[0];

  const orderItems = await Promise.all(
    itemRequirements.map(async ({ item, variant }) => {
      const inv = variant.inventories.find((i) => i.warehouseId === allocatedWarehouse.id);
      const itemCountryId = orderCountry.id;

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
        sellerState: allocatedWarehouse.state,
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
        inventoryId: inv.id,
      };
    }),
  );`;

content = content.replace(t1, r1);

content = content.replace('      inventories: true,', '      inventories: { include: { warehouse: true } },');

const t3 = `    discount,
    couponValidation,
    total,
  };`;
content = content.replace(t3, `    discount,
    couponValidation,
    total,
    allocatedWarehouse,
  };`);

const t4 = `    discount,
    couponValidation,
    total,
  } = await calculateCustomerOrder(customerId, input);`;
content = content.replace(t4, `    discount,
    couponValidation,
    total,
    allocatedWarehouse,
  } = await calculateCustomerOrder(customerId, input);`);

const t5 = `        shippingZoneId: shipping.zoneId,
        notes: input.notes,
        items: {`;
content = content.replace(t5, `        shippingZoneId: shipping.zoneId,
        notes: input.notes,
        warehouseId: allocatedWarehouse.id,
        items: {`);

const t6 = `    for (const item of orderItems) {
      await decrementVariantStock(
        item.variant.id,
        item.quantity,
        order.countryId,
        {
          reason: "customer_order",
          adjustedBy: \`customer:\${customer.id};order:\${order.id}\`,
        },
        tx,
      );
    }`;

const r6 = `    for (const item of orderItems) {
      const updated = await tx.$executeRaw\`
        UPDATE "inventory"
        SET stock = stock - \${item.quantity}
        WHERE id = \${item.inventoryId} AND (stock - "reservedStock") >= \${item.quantity}
      \`;
      if (updated === 0) {
        throw new AppError("One or more items sold out during checkout.", 400);
      }

      const existing = await tx.inventory.findUnique({ where: { id: item.inventoryId }});
      if (existing) {
        await tx.inventoryAdjustment.create({
          data: {
            inventoryId: item.inventoryId,
            variantId: item.variant.id,
            previousQty: existing.stock + item.quantity,
            newQty: existing.stock,
            reason: "customer_order",
            adjustedBy: \`customer:\${customer.id};order:\${order.id}\`,
          }
        });
      }
    }`;
content = content.replace(t6, r6);

const t7 = `  if (expectedSignature !== payload.razorpay_signature) {
    await prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: "FAILED" },
    });
    throw new AppError("Invalid payment signature verification failed.", 400);
  }`;
const r7 = `  if (expectedSignature !== payload.razorpay_signature) {
    await prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: "FAILED" },
    });
    await releaseStock(order.id);
    throw new AppError("Invalid payment signature verification failed.", 400);
  }`;
content = content.replace(t7, r7);

const t8 = `  return updatedOrder;
}`;
const r8 = `  return updatedOrder;
}

export async function releaseStock(orderId: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order || !order.warehouseId) return;

    for (const item of order.items) {
      if (!item.variantId) continue;
      
      const inv = await tx.inventory.findFirst({
        where: { variantId: item.variantId, warehouseId: order.warehouseId },
      });
      if (!inv) continue;

      const updated = await tx.$executeRaw\`
        UPDATE "inventory"
        SET stock = stock + \${item.quantity}
        WHERE id = \${inv.id}
      \`;

      if (updated > 0) {
        await tx.inventoryAdjustment.create({
          data: {
            inventoryId: inv.id,
            variantId: item.variantId,
            previousQty: inv.stock,
            newQty: inv.stock + item.quantity,
            reason: "order_cancelled",
            adjustedBy: \`system:release_stock;order:\${order.id}\`,
          }
        });
      }
    }
  });
}`;
content = content.replace(t8, r8);

fs.writeFileSync(file, content);
console.log("customerOrders refactored safely!");
