import { prisma } from "../config/database";
import {
  reserveOrderInventory,
  commitOrderReservation,
  releaseOrderReservation,
} from "../modules/inventory/inventoryReservation.service";
import { shipOrder, deliverOrder, createAdminOrder } from "../modules/orders/orders.service";
import { convertToOrder } from "../modules/quotes/quotes.service";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  }
}

async function getStock(inventoryId: string) {
  const inv = await prisma.inventory.findUniqueOrThrow({ where: { id: inventoryId } });
  return {
    id: inv.id,
    warehouseId: inv.warehouseId,
    stock: inv.stock,
    reservedStock: inv.reservedStock,
    available: Math.max(0, inv.stock - inv.reservedStock),
  };
}

async function runWarehouseTests() {
  console.log("=================================================");
  console.log("🚀 STARTING COMPREHENSIVE MULTI-WAREHOUSE REGRESSION TESTS");
  console.log("=================================================\n");

  // 1. Fixture setup
  let country = await prisma.country.findFirst({ where: { code: "IN", status: "ACTIVE" } });
  if (!country) {
    let currency = await prisma.currency.findFirst();
    if (!currency) {
      currency = await prisma.currency.create({
        data: { code: "INR", name: "Indian Rupee", symbol: "₹", exchangeRate: 1, isBase: true },
      });
    }
    country = await prisma.country.create({
      data: { code: "IN", name: "India", currencyId: currency.id, status: "ACTIVE" },
    });
  }

  const currency = await prisma.currency.findFirstOrThrow({ where: { id: country.currencyId } });

  let category = await prisma.category.findFirst({ where: { status: "ACTIVE" } });
  if (!category) {
    category = await prisma.category.create({
      data: { name: "Test Category", slug: `test-cat-${Date.now()}`, status: "ACTIVE" },
    });
  }

  const product = await prisma.product.create({
    data: {
      title: `Warehouse Regression Product ${Date.now()}`,
      slug: `wh-reg-prod-${Date.now()}`,
      sku: `SKU-REG-${Date.now()}`,
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
      variantKey: `reg-var-a-${Date.now()}`,
    },
  });

  const variantB = await prisma.productVariant.create({
    data: {
      productId: product.id,
      title: "Variant B (Size 2)",
      sku: `VAR-B-${Date.now()}`,
      variantKey: `reg-var-b-${Date.now()}`,
    },
  });

  await prisma.productPrice.create({
    data: {
      productId: product.id,
      variantId: variantA.id,
      countryId: country.id,
      currencyId: currency.id,
      mrp: 100,
      sellingPrice: 100,
    },
  });

  await prisma.productPrice.create({
    data: {
      productId: product.id,
      variantId: variantB.id,
      countryId: country.id,
      currencyId: currency.id,
      mrp: 150,
      sellingPrice: 150,
    },
  });

  // Create two distinct physical warehouses
  const warehouseA = await prisma.warehouse.create({
    data: {
      name: `Warehouse A - Mumbai ${Date.now()}`,
      countryId: country.id,
      state: "Maharashtra",
      city: "Mumbai",
      status: "ACTIVE",
      deliveryZones: [{ countryId: country.id, states: ["Maharashtra", "Goa"] }],
    },
  });

  const warehouseB = await prisma.warehouse.create({
    data: {
      name: `Warehouse B - Delhi ${Date.now()}`,
      countryId: country.id,
      state: "Delhi",
      city: "New Delhi",
      status: "ACTIVE",
      deliveryZones: [{ countryId: country.id, states: ["Delhi", "Punjab", "Haryana"] }],
    },
  });

  // Initial Inventory setup:
  // Variant A at Warehouse A: stock=10, reserved=0
  const invA_A = await prisma.inventory.create({
    data: {
      productId: product.id,
      variantId: variantA.id,
      warehouseId: warehouseA.id,
      stock: 10,
      reservedStock: 0,
    },
  });

  // Variant A at Warehouse B: stock=20, reserved=0
  const invB_A = await prisma.inventory.create({
    data: {
      productId: product.id,
      variantId: variantA.id,
      warehouseId: warehouseB.id,
      stock: 20,
      reservedStock: 0,
    },
  });

  // Variant A at Base (null): stock=30, reserved=0
  const invBase_A = await prisma.inventory.create({
    data: {
      productId: product.id,
      variantId: variantA.id,
      warehouseId: null,
      stock: 30,
      reservedStock: 0,
    },
  });

  // Variant B at Warehouse B: stock=15, reserved=0
  const invB_B = await prisma.inventory.create({
    data: {
      productId: product.id,
      variantId: variantB.id,
      warehouseId: warehouseB.id,
      stock: 15,
      reservedStock: 0,
    },
  });

  console.log("Initial Fixture Setup Completed successfully.");
  const createdOrderIds: string[] = [];
  const createdQuoteIds: string[] = [];

  try {
    // ----------------------------------------------------------------------
    // TEST 1: Base Inventory Reservation (warehouseId = null) -> Physical Warehouses Untouched
    // ----------------------------------------------------------------------
    console.log("\n--- [Test 1] Base Inventory Reservation (warehouseId = null) ---");
    const orderBase = await prisma.order.create({
      data: {
        orderNumber: `TEST-ORD-BASE-${Date.now()}`,
        customerName: "Base Buyer",
        customerEmail: "base@test.com",
        countryId: country.id,
        currencyId: currency.id,
        subtotal: 200,
        total: 200,
        status: "PENDING",
        paymentStatus: "PENDING",
        shippingAddress: { city: "Anywhere" },
        items: {
          create: [{
            productId: product.id,
            variantId: variantA.id,
            warehouseId: null, // explicit Base Inventory
            title: variantA.title,
            sku: variantA.sku,
            quantity: 4,
            unitPrice: 100,
            total: 400,
          }],
        },
      },
    });
    createdOrderIds.push(orderBase.id);

    await reserveOrderInventory(orderBase.id);

    const sBase_A_afterRes = await getStock(invBase_A.id);
    const sA_A_afterBaseRes = await getStock(invA_A.id);
    const sB_A_afterBaseRes = await getStock(invB_A.id);

    console.log(`Base NULL (Variant A): stock=${sBase_A_afterRes.stock}, reserved=${sBase_A_afterRes.reservedStock}`);
    console.log(`Warehouse A (Variant A): stock=${sA_A_afterBaseRes.stock}, reserved=${sA_A_afterBaseRes.reservedStock}`);
    console.log(`Warehouse B (Variant A): stock=${sB_A_afterBaseRes.stock}, reserved=${sB_A_afterBaseRes.reservedStock}`);

    assert(sBase_A_afterRes.stock === 30 && sBase_A_afterRes.reservedStock === 4, "Base Inventory must be reserved by 4");
    assert(sA_A_afterBaseRes.stock === 10 && sA_A_afterBaseRes.reservedStock === 0, "Warehouse A MUST remain completely UNTOUCHED (reserved=0)");
    assert(sB_A_afterBaseRes.stock === 20 && sB_A_afterBaseRes.reservedStock === 0, "Warehouse B MUST remain completely UNTOUCHED (reserved=0)");
    console.log("✅ Test 1 Passed: Base Inventory strictly isolated without physical warehouse leakage!");

    // ----------------------------------------------------------------------
    // TEST 2: Concrete Warehouse Reservation (warehouseId = Warehouse A)
    // ----------------------------------------------------------------------
    console.log("\n--- [Test 2] Concrete Warehouse Reservation (warehouseId = Warehouse A) ---");
    const orderWhA = await prisma.order.create({
      data: {
        orderNumber: `TEST-ORD-WHA-${Date.now()}`,
        customerName: "WhA Buyer",
        customerEmail: "wha@test.com",
        countryId: country.id,
        currencyId: currency.id,
        subtotal: 200,
        total: 200,
        status: "PENDING",
        paymentStatus: "PENDING",
        shippingAddress: { city: "Mumbai" },
        items: {
          create: [{
            productId: product.id,
            variantId: variantA.id,
            warehouseId: warehouseA.id,
            title: variantA.title,
            sku: variantA.sku,
            quantity: 3,
            unitPrice: 100,
            total: 300,
          }],
        },
      },
    });
    createdOrderIds.push(orderWhA.id);

    await reserveOrderInventory(orderWhA.id);

    const sA_A_afterWhARes = await getStock(invA_A.id);
    const sB_A_afterWhARes = await getStock(invB_A.id);
    const sBase_A_afterWhARes = await getStock(invBase_A.id);

    assert(sA_A_afterWhARes.stock === 10 && sA_A_afterWhARes.reservedStock === 3, "Warehouse A reservedStock must be 3");
    assert(sB_A_afterWhARes.stock === 20 && sB_A_afterWhARes.reservedStock === 0, "Warehouse B must remain UNTOUCHED");
    assert(sBase_A_afterWhARes.stock === 30 && sBase_A_afterWhARes.reservedStock === 4, "Base Inventory must remain unchanged from Test 1");
    console.log("✅ Test 2 Passed: Concrete Warehouse A reservation isolated!");

    // ----------------------------------------------------------------------
    // TEST 3: Missing Concrete Warehouse Inventory Fails Safely (No Silent Fallback)
    // Variant B has NO inventory row at Warehouse A (only at Warehouse B)
    // ----------------------------------------------------------------------
    console.log("\n--- [Test 3] Missing Concrete Warehouse Inventory Fails Safely ---");
    const orderMissingWh = await prisma.order.create({
      data: {
        orderNumber: `TEST-ORD-MISSING-${Date.now()}`,
        customerName: "Missing WH Buyer",
        customerEmail: "missing@test.com",
        countryId: country.id,
        currencyId: currency.id,
        subtotal: 100,
        total: 100,
        status: "PENDING",
        paymentStatus: "PENDING",
        shippingAddress: { city: "Mumbai" },
        items: {
          create: [{
            productId: product.id,
            variantId: variantB.id, // Variant B has no stock record at Warehouse A
            warehouseId: warehouseA.id,
            title: variantB.title,
            sku: variantB.sku,
            quantity: 2,
            unitPrice: 150,
            total: 300,
          }],
        },
      },
    });
    createdOrderIds.push(orderMissingWh.id);

    await reserveOrderInventory(orderMissingWh.id);

    // Verify that neither Warehouse A, Warehouse B, nor Base was mutated!
    const sA_A_afterMissing = await getStock(invA_A.id);
    const sB_A_afterMissing = await getStock(invB_A.id);
    const sB_B_afterMissing = await getStock(invB_B.id);
    const sBase_A_afterMissing = await getStock(invBase_A.id);

    assert(sA_A_afterMissing.reservedStock === 3, "Warehouse A reservedStock must NOT change (still 3)");
    assert(sB_A_afterMissing.reservedStock === 0, "Warehouse B Var A reservedStock must NOT change (still 0)");
    assert(sB_B_afterMissing.reservedStock === 0, "Warehouse B Var B reservedStock must NOT be falsely mutated (still 0)");
    assert(sBase_A_afterMissing.reservedStock === 4, "Base reservedStock must NOT change (still 4)");
    console.log("✅ Test 3 Passed: Missing concrete warehouse inventory record failed safely without silent fallback!");

    // ----------------------------------------------------------------------
    // TEST 4: Base Inventory Shipment Commit
    // ----------------------------------------------------------------------
    console.log("\n--- [Test 4] Base Inventory Shipment Commit ---");
    await shipOrder(orderBase.id, {
      shippingProvider: "BlueDart",
      trackingNumber: "BD-BASE-001",
    });

    const sBase_A_afterCommit = await getStock(invBase_A.id);
    const sA_A_afterCommit = await getStock(invA_A.id);

    assert(sBase_A_afterCommit.stock === 26 && sBase_A_afterCommit.reservedStock === 0, "Base Inventory stock must be 26 (30 - 4), reservedStock=0");
    assert(sA_A_afterCommit.stock === 10 && sA_A_afterCommit.reservedStock === 3, "Warehouse A must remain unaffected");
    console.log("✅ Test 4 Passed: Base Inventory committed cleanly upon shipment!");

    // ----------------------------------------------------------------------
    // TEST 5: Base Inventory Release (Release orderWhA for testing release)
    // ----------------------------------------------------------------------
    console.log("\n--- [Test 5] Warehouse A Reservation Release ---");
    await releaseOrderReservation(orderWhA.id);
    const sA_A_afterRelease = await getStock(invA_A.id);
    assert(sA_A_afterRelease.stock === 10 && sA_A_afterRelease.reservedStock === 0, "Warehouse A reservedStock restored to 0");
    console.log("✅ Test 5 Passed: Reservation released cleanly!");

    // ----------------------------------------------------------------------
    // TEST 6: Multi-Warehouse Order Independent Reservation & Commit
    // ----------------------------------------------------------------------
    console.log("\n--- [Test 6] Multi-Warehouse Order Split (WH-A: 2, WH-B: 3) ---");
    // State before: WH-A (Var A) = stock: 10, res: 0; WH-B (Var B) = stock: 15, res: 0
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
        shippingAddress: { city: "Pune" },
        items: {
          create: [
            {
              productId: product.id,
              variantId: variantA.id,
              warehouseId: warehouseA.id,
              title: variantA.title,
              sku: variantA.sku,
              quantity: 2,
              unitPrice: 100,
              total: 200,
            },
            {
              productId: product.id,
              variantId: variantB.id,
              warehouseId: warehouseB.id,
              title: variantB.title,
              sku: variantB.sku,
              quantity: 3,
              unitPrice: 100,
              total: 300,
            },
          ],
        },
      },
    });
    createdOrderIds.push(multiOrder.id);

    await reserveOrderInventory(multiOrder.id);
    const sA_A_multiRes = await getStock(invA_A.id);
    const sB_B_multiRes = await getStock(invB_B.id);

    assert(sA_A_multiRes.stock === 10 && sA_A_multiRes.reservedStock === 2, "Warehouse A Var A reserved must be 2");
    assert(sB_B_multiRes.stock === 15 && sB_B_multiRes.reservedStock === 3, "Warehouse B Var B reserved must be 3");

    // Commit multiOrder
    await shipOrder(multiOrder.id, { shippingProvider: "DHL", trackingNumber: "DHL-MULTI-001" });
    const sA_A_multiShip = await getStock(invA_A.id);
    const sB_B_multiShip = await getStock(invB_B.id);

    assert(sA_A_multiShip.stock === 8 && sA_A_multiShip.reservedStock === 0, "Warehouse A committed 2 (stock=8, res=0)");
    assert(sB_B_multiShip.stock === 12 && sB_B_multiShip.reservedStock === 0, "Warehouse B committed 3 (stock=12, res=0)");
    console.log("✅ Test 6 Passed: Multi-warehouse order cleanly reserved and committed across distinct facilities!");

    // ----------------------------------------------------------------------
    // TEST 7: Admin Order with Explicit Warehouse A
    // ----------------------------------------------------------------------
    console.log("\n--- [Test 7] Admin Order with Explicit Warehouse A ---");
    const adminOrderWhA = await createAdminOrder({
      customerName: "Admin Customer 1",
      customerEmail: "admincust1@test.com",
      countryId: country.id,
      items: [{
        productId: product.id,
        variantId: variantA.id,
        quantity: 2,
        warehouseId: warehouseA.id, // Explicit Warehouse A
      }],
    });
    createdOrderIds.push(adminOrderWhA.id);

    const sA_A_adminWhA = await getStock(invA_A.id);
    assert(adminOrderWhA.items[0].warehouseId === warehouseA.id, "Admin OrderItem.warehouseId must be Warehouse A");
    assert(sA_A_adminWhA.stock === 8 && sA_A_adminWhA.reservedStock === 2, "Warehouse A reservedStock must be 2");
    console.log("✅ Test 7 Passed: Admin Order with explicit warehouse preserved and reserved!");

    // ----------------------------------------------------------------------
    // TEST 8: Admin Order with Explicit Base Inventory (warehouseId = null)
    // ----------------------------------------------------------------------
    console.log("\n--- [Test 8] Admin Order with Explicit Base Inventory (warehouseId = null) ---");
    // State of Base Var A before: stock=26, res=0
    const adminOrderBase = await createAdminOrder({
      customerName: "Admin Customer 2",
      customerEmail: "admincust2@test.com",
      countryId: country.id,
      items: [{
        productId: product.id,
        variantId: variantA.id,
        quantity: 3,
        warehouseId: null, // Explicit Base
      }],
    });
    createdOrderIds.push(adminOrderBase.id);

    const sBase_A_adminBase = await getStock(invBase_A.id);
    const sA_A_adminBase = await getStock(invA_A.id);

    assert(adminOrderBase.items[0].warehouseId === null, "Admin OrderItem.warehouseId must be null");
    assert(sBase_A_adminBase.stock === 26 && sBase_A_adminBase.reservedStock === 3, "Base Inventory reservedStock must be 3");
    assert(sA_A_adminBase.reservedStock === 2, "Warehouse A reservedStock must remain unchanged (2)");
    console.log("✅ Test 8 Passed: Admin Order with explicit Base Inventory strictly reserved Base!");

    // ----------------------------------------------------------------------
    // TEST 9: Admin Order with Auto-Resolution (warehouseId = undefined)
    // ----------------------------------------------------------------------
    console.log("\n--- [Test 9] Admin Order with Auto-Resolution (warehouseId = undefined) ---");
    // Destination is Maharashtra -> Nearest eligible is Warehouse A (Mumbai)
    const adminOrderAuto = await createAdminOrder({
      customerName: "Admin Customer 3",
      customerEmail: "admincust3@test.com",
      countryId: country.id,
      shippingAddress: { city: "Nagpur", state: "Maharashtra" },
      items: [{
        productId: product.id,
        variantId: variantA.id,
        quantity: 2,
        warehouseId: undefined, // Auto-resolve
      }],
    });
    createdOrderIds.push(adminOrderAuto.id);

    const sA_A_adminAuto = await getStock(invA_A.id);
    assert(adminOrderAuto.items[0].warehouseId === warehouseA.id, "Auto-resolved warehouse for Maharashtra must be Warehouse A (Mumbai)");
    assert(sA_A_adminAuto.reservedStock === 4, "Warehouse A reservedStock must be 4 (2 + 2)");
    console.log("✅ Test 9 Passed: Admin Order auto-resolution selected nearest eligible warehouse (Warehouse A)!");

    // ----------------------------------------------------------------------
    // TEST 10: Admin Order Auto-Resolution when Nearest is Insufficient -> Falls back to Base Seller
    // ----------------------------------------------------------------------
    console.log("\n--- [Test 10] Admin Order Auto-Resolution: Nearest Insufficient -> Base Fallback ---");
    // Warehouse A has stock=8, reserved=4 -> available = 4.
    // Admin requests quantity = 5 for Maharashtra.
    // Warehouse A cannot fulfill (4 < 5). Delhi does not deliver to Maharashtra.
    // Base Inventory has stock=26, reserved=3 -> available = 23.
    // Expected: Auto-resolves to Base Inventory (warehouseId = null).
    const adminOrderFallback = await createAdminOrder({
      customerName: "Admin Customer 4",
      customerEmail: "admincust4@test.com",
      countryId: country.id,
      shippingAddress: { city: "Mumbai", state: "Maharashtra" },
      items: [{
        productId: product.id,
        variantId: variantA.id,
        quantity: 5,
        warehouseId: undefined, // Auto-resolve
      }],
    });
    createdOrderIds.push(adminOrderFallback.id);

    const sBase_A_afterFallback = await getStock(invBase_A.id);
    const sA_A_afterFallback = await getStock(invA_A.id);

    assert(adminOrderFallback.items[0].warehouseId === null, "Must auto-fallback to Base Inventory when nearest physical warehouse is insufficient");
    assert(sBase_A_afterFallback.reservedStock === 8, "Base Inventory reservedStock must be 8 (3 + 5)");
    assert(sA_A_afterFallback.reservedStock === 4, "Warehouse A reservedStock must remain 4 (unchanged)");
    console.log("✅ Test 10 Passed: Auto-resolution correctly fell back to Base Seller when nearest warehouse had insufficient stock!");

    // ----------------------------------------------------------------------
    // TEST 11: Quote -> Order Conversion with Auto-Resolution & Transactional Reservation
    // ----------------------------------------------------------------------
    console.log("\n--- [Test 11] Quote -> Order Conversion Auto-Resolution & Reservation ---");
    const quote = await prisma.quote.create({
      data: {
        quoteNumber: `QUO-REG-${Date.now()}`,
        customerName: "Quote Customer",
        customerEmail: "quote@test.com",
        countryId: country.id,
        currencyId: currency.id,
        subtotal: 200,
        total: 200,
        status: "ACCEPTED",
        shippingAddress: { city: "New Delhi", state: "Delhi" },
        items: {
          create: [{
            productId: product.id,
            variantId: variantA.id,
            title: variantA.title,
            sku: variantA.sku,
            quantity: 3,
            unitPrice: 100,
            total: 300,
          }],
        },
      },
      include: { items: true },
    });
    createdQuoteIds.push(quote.id);

    // Convert quote to order (Delhi address -> Warehouse B should be auto-resolved)
    const convertedOrder = await convertToOrder(quote.id);
    createdOrderIds.push(convertedOrder.id);

    const sB_A_quoteRes = await getStock(invB_A.id);
    const updatedQuote = await prisma.quote.findUniqueOrThrow({ where: { id: quote.id } });

    assert(updatedQuote.status === "CONVERTED", "Quote status must be CONVERTED");
    assert(updatedQuote.convertedOrderId === convertedOrder.id, "convertedOrderId must match converted order ID");
    assert(convertedOrder.items[0].warehouseId === warehouseB.id, "Converted OrderItem must be assigned to Warehouse B (Delhi)");
    assert(sB_A_quoteRes.stock === 20 && sB_A_quoteRes.reservedStock === 3, "Warehouse B Var A reservedStock must be 3");
    console.log("✅ Test 11 Passed: Quote converted to order, auto-resolved Warehouse B, and transactionally reserved inventory!");

    // ----------------------------------------------------------------------
    // TEST 12: Repeated Commit & Release Idempotency Across Multiple Warehouses
    // ----------------------------------------------------------------------
    console.log("\n--- [Test 12] Repeated Commit & Release Idempotency ---");
    // Double commit multiOrder (already committed in Test 6)
    await commitOrderReservation(multiOrder.id);
    const sA_A_doubleCommit = await getStock(invA_A.id);
    const sB_B_doubleCommit = await getStock(invB_B.id);

    console.log(`Warehouse A: stock=${sA_A_doubleCommit.stock}, reserved=${sA_A_doubleCommit.reservedStock}`);
    console.log(`Warehouse B: stock=${sB_B_doubleCommit.stock}, reserved=${sB_B_doubleCommit.reservedStock}`);

    assert(sA_A_doubleCommit.stock === 8 && sA_A_doubleCommit.reservedStock === 4, "Warehouse A must remain stock=8, reservedStock=4");
    assert(sB_B_doubleCommit.stock === 12 && sB_B_doubleCommit.reservedStock === 0, "Warehouse B must remain stock=12, reservedStock=0");

    // Double release orderWhA (already released in Test 5)
    await releaseOrderReservation(orderWhA.id);
    const sA_A_doubleRel = await getStock(invA_A.id);
    assert(sA_A_doubleRel.reservedStock === 4, "Warehouse A reservedStock must remain untouched (4)");
    console.log("✅ Test 12 Passed: Commit and release idempotency fully verified!");

    // ----------------------------------------------------------------------
    // TEST 13: Delivery Status Update Zero Inventory Mutation
    // ----------------------------------------------------------------------
    console.log("\n--- [Test 13] Delivery Status Update Zero Inventory Mutation ---");
    await deliverOrder(multiOrder.id);
    const sA_A_delivered = await getStock(invA_A.id);
    const sB_B_delivered = await getStock(invB_B.id);

    assert(sA_A_delivered.stock === 8 && sA_A_delivered.reservedStock === 4, "Warehouse A stock unchanged after delivery (8, res=4)");
    assert(sB_B_delivered.stock === 12 && sB_B_delivered.reservedStock === 0, "Warehouse B stock unchanged after delivery (12, res=0)");
    console.log("✅ Test 13 Passed: Delivery performs zero inventory mutation!");

    console.log("\n=================================================");
    console.log("🎉 ALL 13 COMPREHENSIVE REGRESSION TESTS PASSED!");
    console.log("=================================================\n");
  } finally {
    // Cleanup
    if (createdOrderIds.length > 0) {
      await prisma.inventoryAdjustment.deleteMany({
        where: { adjustedBy: { in: createdOrderIds.flatMap(id => [
          `system:reservation;order:${id}`,
          `system:shipment_commit;order:${id}`,
          `system:reservation_release;order:${id}`,
        ]) } },
      });
      await prisma.shipment.deleteMany({ where: { orderId: { in: createdOrderIds } } });
      await prisma.orderItem.deleteMany({ where: { orderId: { in: createdOrderIds } } });
      await prisma.order.deleteMany({ where: { id: { in: createdOrderIds } } });
    }
    if (createdQuoteIds.length > 0) {
      await prisma.quoteItem.deleteMany({ where: { quoteId: { in: createdQuoteIds } } });
      await prisma.quote.deleteMany({ where: { id: { in: createdQuoteIds } } });
    }
    await prisma.inventory.deleteMany({ where: { productId: product.id } });
    await prisma.productPrice.deleteMany({ where: { productId: product.id } });
    await prisma.productVariant.deleteMany({ where: { productId: product.id } });
    await prisma.product.delete({ where: { id: product.id } });
    await prisma.warehouse.deleteMany({ where: { id: { in: [warehouseA.id, warehouseB.id] } } });
    console.log("Cleaned up test fixture successfully.");
  }
}

runWarehouseTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Comprehensive Multi-Warehouse Test execution failed:", err);
    process.exit(1);
  });
