import { prisma } from "../config/database";
import {
  reserveOrderInventory,
  commitOrderReservation,
  releaseOrderReservation,
} from "../modules/inventory/inventoryReservation.service";
import { shipOrder, deliverOrder } from "../modules/orders/orders.service";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  }
}

async function getStock(inventoryId: string) {
  const inv = await prisma.inventory.findUniqueOrThrow({ where: { id: inventoryId } });
  return {
    stock: inv.stock,
    reservedStock: inv.reservedStock,
    available: Math.max(0, inv.stock - inv.reservedStock),
  };
}

async function runTests() {
  console.log("=================================================");
  console.log("🚀 STARTING PHASE 1 INVENTORY REGRESSION TESTS");
  console.log("=================================================\n");

  // 1. Setup Test Fixture
  let country = await prisma.country.findFirst({ where: { status: "ACTIVE" } });
  if (!country) {
    let currency = await prisma.currency.findFirst();
    if (!currency) {
      currency = await prisma.currency.create({
        data: {
          code: "INR",
          name: "Indian Rupee",
          symbol: "₹",
          exchangeRate: 1,
          isBase: true,
        },
      });
    }
    country = await prisma.country.create({
      data: {
        code: "IN",
        name: "India",
        currencyId: currency.id,
        status: "ACTIVE",
      },
    });
  }

  const currency = await prisma.currency.findFirstOrThrow({ where: { id: country.currencyId } });

  let category = await prisma.category.findFirst({ where: { status: "ACTIVE" } });
  if (!category) {
    category = await prisma.category.create({
      data: {
        name: "Test Category",
        slug: `test-cat-${Date.now()}`,
        status: "ACTIVE",
      },
    });
  }

  const product = await prisma.product.create({
    data: {
      title: `Phase1 Test Product ${Date.now()}`,
      slug: `phase1-test-product-${Date.now()}`,
      sku: `SKU-P1-${Date.now()}`,
      status: "ACTIVE",
      categoryId: category.id,
      defaultCountryId: country.id,
    },
  });

  const variantA = await prisma.productVariant.create({
    data: {
      productId: product.id,
      title: "Variant A (Size 1)",
      sku: `VAR-A-${Date.now()}`,
      variantKey: `p1-var-a-${Date.now()}`,
    },
  });

  const variantB = await prisma.productVariant.create({
    data: {
      productId: product.id,
      title: "Variant B (Size 2)",
      sku: `VAR-B-${Date.now()}`,
      variantKey: `p1-var-b-${Date.now()}`,
    },
  });

  let warehouseA = await prisma.warehouse.findFirst();
  if (!warehouseA) {
    warehouseA = await prisma.warehouse.create({
      data: {
        name: "Main Warehouse",
        countryId: country.id,
        state: "Maharashtra",
        city: "Mumbai",
        status: "ACTIVE",
      },
    });
  }

  // Initial Inventory: Variant A = 10, Variant B = 20
  const invA = await prisma.inventory.create({
    data: {
      productId: product.id,
      variantId: variantA.id,
      warehouseId: warehouseA.id,
      stock: 10,
      reservedStock: 0,
    },
  });

  const invB = await prisma.inventory.create({
    data: {
      productId: product.id,
      variantId: variantB.id,
      warehouseId: warehouseA.id,
      stock: 20,
      reservedStock: 0,
    },
  });

  console.log(`Setup complete. Initial Stock -> Variant A: ${invA.stock}, Variant B: ${invB.stock}`);

  try {
    // -------------------------------------------------------------
    // Test A: Pending Order reserves inventory (stock unchanged, reservedStock += 2)
    // -------------------------------------------------------------
    console.log("\n--- [Test A] Pending Order Reserves Inventory ---");
    const order1 = await prisma.order.create({
      data: {
        orderNumber: `TEST-ORD-A-${Date.now()}`,
        customerName: "Test Buyer",
        customerEmail: "buyer@test.com",
        countryId: country.id,
        currencyId: currency.id,
        subtotal: 200,
        total: 200,
        status: "PENDING",
        paymentStatus: "PENDING",
        paymentExpiresAt: new Date(Date.now() + 4 * 60 * 1000),
        shippingAddress: { city: "Mumbai" },
        items: {
          create: [{
            productId: product.id,
            variantId: variantA.id,
            warehouseId: warehouseA.id,
            title: variantA.title,
            sku: variantA.sku,
            quantity: 2,
            unitPrice: 100,
            total: 200,
          }],
        },
      },
    });

    await reserveOrderInventory(order1.id);
    const stockA_AfterOrder1 = await getStock(invA.id);
    console.log(`Stock after Order 1 (qty 2): stock=${stockA_AfterOrder1.stock}, reservedStock=${stockA_AfterOrder1.reservedStock}, available=${stockA_AfterOrder1.available}`);

    assert(stockA_AfterOrder1.stock === 10, "Physical stock MUST NOT decrease upon order creation!");
    assert(stockA_AfterOrder1.reservedStock === 2, "Reserved stock MUST increase by item quantity (2)!");
    assert(stockA_AfterOrder1.available === 8, "Available stock MUST be physical stock - reservedStock (8)!");
    console.log("✅ Test A Passed!");

    // -------------------------------------------------------------
    // Test B: Failed / Abandoned Payment releases reservation
    // -------------------------------------------------------------
    console.log("\n--- [Test B] Failed / Abandoned Payment Releases Reservation ---");
    await releaseOrderReservation(order1.id);
    const stockA_AfterRelease = await getStock(invA.id);
    console.log(`Stock after Release: stock=${stockA_AfterRelease.stock}, reservedStock=${stockA_AfterRelease.reservedStock}, available=${stockA_AfterRelease.available}`);

    assert(stockA_AfterRelease.stock === 10, "Physical stock MUST remain unchanged on reservation release (10)!");
    assert(stockA_AfterRelease.reservedStock === 0, "Reserved stock MUST be restored to 0!");
    assert(stockA_AfterRelease.available === 10, "Available stock MUST be fully restored to 10!");
    console.log("✅ Test B Passed!");

    // -------------------------------------------------------------
    // Test C: Payment success does NOT yet deduct physical stock
    // -------------------------------------------------------------
    console.log("\n--- [Test C] Payment Success Keeps Reservation Active ---");
    const order2 = await prisma.order.create({
      data: {
        orderNumber: `TEST-ORD-C-${Date.now()}`,
        customerName: "Test Buyer 2",
        customerEmail: "buyer2@test.com",
        countryId: country.id,
        currencyId: currency.id,
        subtotal: 200,
        total: 200,
        status: "PENDING",
        paymentStatus: "PENDING",
        shippingAddress: { city: "Delhi" },
        items: {
          create: [{
            productId: product.id,
            variantId: variantA.id,
            warehouseId: warehouseA.id,
            title: variantA.title,
            sku: variantA.sku,
            quantity: 2,
            unitPrice: 100,
            total: 200,
          }],
        },
      },
    });

    await reserveOrderInventory(order2.id);
    // Simulate successful payment
    await prisma.order.update({
      where: { id: order2.id },
      data: { paymentStatus: "PAID", status: "PROCESSING" },
    });

    const stockA_AfterPaid = await getStock(invA.id);
    console.log(`Stock after Payment PAID: stock=${stockA_AfterPaid.stock}, reservedStock=${stockA_AfterPaid.reservedStock}, available=${stockA_AfterPaid.available}`);

    assert(stockA_AfterPaid.stock === 10, "Physical stock MUST NOT decrease when payment becomes PAID!");
    assert(stockA_AfterPaid.reservedStock === 2, "Reserved stock MUST remain reserved while order is in PROCESSING!");
    assert(stockA_AfterPaid.available === 8, "Available stock MUST remain 8!");
    console.log("✅ Test C Passed!");

    // -------------------------------------------------------------
    // Test D: Shipment commits inventory (stock -= 2, reservedStock -= 2)
    // -------------------------------------------------------------
    console.log("\n--- [Test D] Shipment Commits Stock ---");
    await shipOrder(order2.id, {
      shippingProvider: "DHL",
      trackingNumber: "TRK123456",
    });

    const stockA_AfterShipment = await getStock(invA.id);
    console.log(`Stock after Shipment: stock=${stockA_AfterShipment.stock}, reservedStock=${stockA_AfterShipment.reservedStock}, available=${stockA_AfterShipment.available}`);

    assert(stockA_AfterShipment.stock === 8, "Physical stock MUST be decremented to 8 upon shipment!");
    assert(stockA_AfterShipment.reservedStock === 0, "Reserved stock MUST be decremented to 0 upon shipment commit!");
    assert(stockA_AfterShipment.available === 8, "Available stock MUST be 8!");
    console.log("✅ Test D Passed!");

    // -------------------------------------------------------------
    // Test E: Delivery does NOT deduct inventory again
    // -------------------------------------------------------------
    console.log("\n--- [Test E] Delivery Does NOT Deduct Inventory Again ---");
    await deliverOrder(order2.id);

    const stockA_AfterDelivery = await getStock(invA.id);
    console.log(`Stock after Delivery: stock=${stockA_AfterDelivery.stock}, reservedStock=${stockA_AfterDelivery.reservedStock}, available=${stockA_AfterDelivery.available}`);

    assert(stockA_AfterDelivery.stock === 8, "Physical stock MUST remain 8 after delivery (NO double deduction)!");
    assert(stockA_AfterDelivery.reservedStock === 0, "Reserved stock MUST remain 0!");
    assert(stockA_AfterDelivery.available === 8, "Available stock MUST remain 8!");
    console.log("✅ Test E Passed!");

    // -------------------------------------------------------------
    // Test F: Repeated commit is idempotent
    // -------------------------------------------------------------
    console.log("\n--- [Test F] Repeated Commit Is Idempotent ---");
    await commitOrderReservation(order2.id); // Call commit second time
    const stockA_AfterDoubleCommit = await getStock(invA.id);

    assert(stockA_AfterDoubleCommit.stock === 8, "Repeated commit MUST NOT decrease stock again (remains 8)!");
    assert(stockA_AfterDoubleCommit.reservedStock === 0, "Reserved stock remains 0!");
    console.log("✅ Test F Passed!");

    // -------------------------------------------------------------
    // Test G: Repeated release is idempotent
    // -------------------------------------------------------------
    console.log("\n--- [Test G] Repeated Release Is Idempotent ---");
    await releaseOrderReservation(order1.id); // Call release second time
    const stockA_AfterDoubleRelease = await getStock(invA.id);

    assert(stockA_AfterDoubleRelease.stock === 8, "Physical stock MUST remain 8!");
    assert(stockA_AfterDoubleRelease.reservedStock === 0, "Reserved stock MUST NOT become negative!");
    console.log("✅ Test G Passed!");

    // -------------------------------------------------------------
    // Test H: Multiple Variants and Items
    // -------------------------------------------------------------
    console.log("\n--- [Test H] Multiple Order Items Handled Independently ---");
    // Initial: A=8 (reserved 0), B=20 (reserved 0)
    const multiOrder = await prisma.order.create({
      data: {
        orderNumber: `TEST-ORD-MULTI-${Date.now()}`,
        customerName: "Multi Buyer",
        customerEmail: "multi@test.com",
        countryId: country.id,
        currencyId: currency.id,
        subtotal: 500,
        total: 500,
        status: "PENDING",
        paymentStatus: "PENDING",
        shippingAddress: { city: "Bengaluru" },
        items: {
          create: [
            {
              productId: product.id,
              variantId: variantA.id,
              warehouseId: warehouseA.id,
              title: variantA.title,
              sku: variantA.sku,
              quantity: 3,
              unitPrice: 100,
              total: 300,
            },
            {
              productId: product.id,
              variantId: variantB.id,
              warehouseId: warehouseA.id,
              title: variantB.title,
              sku: variantB.sku,
              quantity: 5,
              unitPrice: 40,
              total: 200,
            },
          ],
        },
      },
    });

    await reserveOrderInventory(multiOrder.id);
    const stockA_MultiReserved = await getStock(invA.id);
    const stockB_MultiReserved = await getStock(invB.id);

    assert(
      stockA_MultiReserved.stock === 8 && stockA_MultiReserved.reservedStock === 3 && stockA_MultiReserved.available === 5,
      "Variant A should have stock=8, reserved=3, available=5",
    );
    assert(
      stockB_MultiReserved.stock === 20 && stockB_MultiReserved.reservedStock === 5 && stockB_MultiReserved.available === 15,
      "Variant B should have stock=20, reserved=5, available=15",
    );

    // Ship multiOrder
    await shipOrder(multiOrder.id, { shippingProvider: "DTDC", trackingNumber: "DTDC-999" });
    const stockA_MultiShipped = await getStock(invA.id);
    const stockB_MultiShipped = await getStock(invB.id);

    assert(
      stockA_MultiShipped.stock === 5 && stockA_MultiShipped.reservedStock === 0 && stockA_MultiShipped.available === 5,
      "Variant A after ship should have stock=5, reserved=0, available=5",
    );
    assert(
      stockB_MultiShipped.stock === 15 && stockB_MultiShipped.reservedStock === 0 && stockB_MultiShipped.available === 15,
      "Variant B after ship should have stock=15, reserved=0, available=15",
    );

    // Deliver multiOrder
    await deliverOrder(multiOrder.id);
    const stockA_MultiDelivered = await getStock(invA.id);
    const stockB_MultiDelivered = await getStock(invB.id);

    assert(
      stockA_MultiDelivered.stock === 5 && stockA_MultiDelivered.available === 5,
      "Variant A after deliver must remain stock=5 (ZERO deduction on delivery)",
    );
    assert(
      stockB_MultiDelivered.stock === 15 && stockB_MultiDelivered.available === 15,
      "Variant B after deliver must remain stock=15 (ZERO deduction on delivery)",
    );

    console.log("✅ Test H Passed!");

    console.log("\n=================================================");
    console.log("🎉 ALL PHASE 1 INVENTORY REGRESSION TESTS PASSED!");
    console.log("=================================================\n");
  } finally {
    // Cleanup test data
    await prisma.inventoryAdjustment.deleteMany({ where: { inventoryId: { in: [invA.id, invB.id] } } });
    await prisma.inventory.deleteMany({ where: { id: { in: [invA.id, invB.id] } } });
    await prisma.orderItem.deleteMany({ where: { productId: product.id } });
    await prisma.order.deleteMany({ where: { customerEmail: { in: ["buyer@test.com", "buyer2@test.com", "multi@test.com"] } } });
    await prisma.productVariant.deleteMany({ where: { productId: product.id } });
    await prisma.product.delete({ where: { id: product.id } });
    console.log("Cleaned up test fixture successfully.");
  }
}

runTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  });
