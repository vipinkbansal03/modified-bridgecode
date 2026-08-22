import { prisma } from "../config/database";
import { getCustomerOrderTracking, buildTrackingUrl, getShipmentStatusLabel } from "../modules/customerOrders/customerOrders.service";
import { trackShipmentFromProvider } from "../modules/shipping/shipping.service";
import { registerAdapter } from "../modules/shipping/adapters";
import type { ShippingProviderAdapter } from "../modules/shipping/adapters/types";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function runCustomerTrackingTests() {
  console.log("\n=======================================================");
  console.log("  PHASE 1: CUSTOMER ORDER TRACKING REGRESSION SUITE");
  console.log("=======================================================\n");

  const timestamp = Date.now();

  // Setup Country & Currency
  let country = await prisma.country.findFirst({ where: { code: "IN" } });
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
      data: { name: "Test Category", slug: `test-cat-${timestamp}`, status: "ACTIVE" },
    });
  }

  // Setup Test Customers
  const customerA = await prisma.customer.create({
    data: {
      email: `track_cust_a_${timestamp}@example.com`,
      firstName: "Alice",
      lastName: "Tracker",
      passwordHash: "test_hash",
      status: "ACTIVE",
    },
  });

  const customerB = await prisma.customer.create({
    data: {
      email: `track_cust_b_${timestamp}@example.com`,
      firstName: "Bob",
      lastName: "Intruder",
      passwordHash: "test_hash",
      status: "ACTIVE",
    },
  });

  // Setup Warehouses
  const warehouseDelhi = await prisma.warehouse.create({
    data: { name: `Delhi WH ${timestamp}`, countryId: country.id, state: "Delhi", city: "Delhi", status: "ACTIVE" },
  });
  const warehouseMumbai = await prisma.warehouse.create({
    data: { name: `Mumbai WH ${timestamp}`, countryId: country.id, state: "Maharashtra", city: "Mumbai", status: "ACTIVE" },
  });

  // Setup Shipping Providers
  const dtdcProvider = await prisma.shippingProvider.upsert({
    where: { name: "DTDC" },
    update: { trackingUrl: "https://www.dtdc.in/tracking/{tracking}" },
    create: {
      name: "DTDC",
      displayName: "DTDC Courier",
      trackingUrl: "https://www.dtdc.in/tracking/{tracking}",
      isEnabled: true,
    },
  });

  const dhlProvider = await prisma.shippingProvider.upsert({
    where: { name: "DHL" },
    update: { trackingUrl: "https://track.dhl.com/{tracking}" },
    create: {
      name: "DHL",
      displayName: "DHL Express",
      trackingUrl: "https://track.dhl.com/{tracking}",
      isEnabled: true,
    },
  });

  // Setup Product & Variant & Inventory
  const product = await prisma.product.create({
    data: {
      title: "Tracking Test Bracket",
      slug: `track-bracket-${timestamp}`,
      status: "ACTIVE",
      categoryId: category.id,
      defaultCountryId: country.id,
      defaultCurrencyId: currency.id,
    },
  });

  const variantA = await prisma.productVariant.create({
    data: {
      productId: product.id,
      title: "Delhi Variant",
      sku: `DELHI-VAR-${timestamp}`,
      variantKey: `delhi-var-${timestamp}`,
      status: "ACTIVE",
    },
  });

  const variantB = await prisma.productVariant.create({
    data: {
      productId: product.id,
      title: "Mumbai Variant",
      sku: `MUMBAI-VAR-${timestamp}`,
      variantKey: `mumbai-var-${timestamp}`,
      status: "ACTIVE",
    },
  });

  const invDelhi = await prisma.inventory.create({
    data: {
      productId: product.id,
      variantId: variantA.id,
      warehouseId: warehouseDelhi.id,
      stock: 50,
      reservedStock: 0,
    },
  });

  const invMumbai = await prisma.inventory.create({
    data: {
      productId: product.id,
      variantId: variantB.id,
      warehouseId: warehouseMumbai.id,
      stock: 50,
      reservedStock: 0,
    },
  });

  // -------------------------------------------------------------
  // TEST 1: Customer Own Order Tracking
  // -------------------------------------------------------------
  console.log("[Test 1] Customer Can Retrieve Tracking for Their Own Order");
  const order1 = await prisma.order.create({
    data: {
      orderNumber: `ORD-TRK-1-${timestamp}`,
      customerName: "Alice Tracker",
      customerEmail: customerA.email,
      customerId: customerA.id,
      countryId: country.id,
      currencyId: currency.id,
      shippingAddress: { city: "Delhi", state: "Delhi", countryCode: "IN" },
      subtotal: 500,
      total: 500,
      status: "SHIPPED",
      paymentStatus: "PAID",
    },
  });

  const shipment1 = await prisma.shipment.create({
    data: {
      orderId: order1.id,
      providerId: dtdcProvider.id,
      warehouseId: warehouseDelhi.id,
      trackingNumber: "DTDC12345678",
      awbNumber: "DTDC12345678",
      status: "IN_TRANSIT",
      estimatedDelivery: "2026-08-30",
    },
  });

  await prisma.shipmentEvent.createMany({
    data: [
      {
        shipmentId: shipment1.id,
        status: "LABEL_GENERATED",
        location: "Delhi Hub",
        description: "Label created",
        timestamp: new Date(Date.now() - 3600000),
      },
      {
        shipmentId: shipment1.id,
        status: "IN_TRANSIT",
        location: "Jaipur Center",
        description: "Arrived at Jaipur",
        timestamp: new Date(Date.now() - 1800000),
      },
    ],
  });

  const trackingRes1 = await getCustomerOrderTracking(customerA.id, order1.id);
  assert(trackingRes1.orderId === order1.id, "Tracking returns correct orderId");
  assert(trackingRes1.orderNumber === order1.orderNumber, "Tracking returns correct orderNumber");
  assert(trackingRes1.shipments.length === 1, "Returns 1 shipment");
  assert(trackingRes1.shipments[0].trackingNumber === "DTDC12345678", "Returns correct trackingNumber");
  assert(trackingRes1.shipments[0].status === "IN_TRANSIT", "Returns normalized status IN_TRANSIT");
  assert(trackingRes1.shipments[0].statusLabel === "In Transit", "Returns user-friendly statusLabel 'In Transit'");
  assert(trackingRes1.shipments[0].provider.name === "DTDC", "Returns provider name DTDC");

  // -------------------------------------------------------------
  // TEST 2: Other Customer's Order Access Denied (404)
  // -------------------------------------------------------------
  console.log("\n[Test 2] Other Customer Cannot Access Order Tracking (Authorization Guard)");
  let errorCaught = false;
  try {
    await getCustomerOrderTracking(customerB.id, order1.id);
  } catch (err: any) {
    errorCaught = true;
    assert(err.statusCode === 404, "Throws 404 Not Found for unauthorized customer request");
  }
  assert(errorCaught, "Unauthorized customer was strictly denied access");

  // -------------------------------------------------------------
  // TEST 3: Single Shipment Details & Events
  // -------------------------------------------------------------
  console.log("\n[Test 3] Single Shipment Details & Events Payload");
  assert(trackingRes1.shipments[0].events.length === 2, "Shipment has 2 tracking events");
  assert(trackingRes1.shipments[0].events[0].status === "LABEL_GENERATED", "First event status is LABEL_GENERATED");
  assert(trackingRes1.shipments[0].events[0].statusLabel === "Shipment Prepared", "First event statusLabel is 'Shipment Prepared'");
  assert(trackingRes1.shipments[0].events[1].status === "IN_TRANSIT", "Second event status is IN_TRANSIT");
  assert(trackingRes1.shipments[0].events[1].location === "Jaipur Center", "Second event records accurate location");

  // -------------------------------------------------------------
  // TEST 4: Multi-Warehouse Split Shipments (DTDC & DHL)
  // -------------------------------------------------------------
  console.log("\n[Test 4] Multi-Warehouse Split Shipments (DTDC & DHL)");
  const orderMulti = await prisma.order.create({
    data: {
      orderNumber: `ORD-MULTI-${timestamp}`,
      customerName: "Alice Tracker",
      customerEmail: customerA.email,
      customerId: customerA.id,
      countryId: country.id,
      currencyId: currency.id,
      shippingAddress: { city: "Delhi", state: "Delhi", countryCode: "IN" },
      subtotal: 1500,
      total: 1500,
      status: "SHIPPED",
      paymentStatus: "PAID",
      items: {
        create: [
          {
            productId: product.id,
            variantId: variantA.id,
            title: "Delhi Bracket Pack",
            sku: "DELHI-VAR-SKU",
            quantity: 3,
            unitPrice: 100,
            total: 300,
            warehouseId: warehouseDelhi.id,
          },
          {
            productId: product.id,
            variantId: variantB.id,
            title: "Mumbai Bracket Pack",
            sku: "MUMBAI-VAR-SKU",
            quantity: 6,
            unitPrice: 200,
            total: 1200,
            warehouseId: warehouseMumbai.id,
          },
        ],
      },
    },
  });

  // Shipment 1: Delhi WH via DTDC
  const shipDelhi = await prisma.shipment.create({
    data: {
      orderId: orderMulti.id,
      providerId: dtdcProvider.id,
      warehouseId: warehouseDelhi.id,
      trackingNumber: "DTDC-DEL-999",
      awbNumber: "DTDC-DEL-999",
      status: "PICKED_UP",
    },
  });

  // Shipment 2: Mumbai WH via DHL
  const shipMumbai = await prisma.shipment.create({
    data: {
      orderId: orderMulti.id,
      providerId: dhlProvider.id,
      warehouseId: warehouseMumbai.id,
      trackingNumber: "DHL-MUM-888",
      awbNumber: "DHL-MUM-888",
      status: "OUT_FOR_DELIVERY",
    },
  });

  const trackingResMulti = await getCustomerOrderTracking(customerA.id, orderMulti.id);
  assert(trackingResMulti.isMultiShipment === true, "Reports isMultiShipment: true");
  assert(trackingResMulti.shipments.length === 2, "Returns both split shipments independently");

  const dtdcShip = trackingResMulti.shipments.find((s) => s.provider.name === "DTDC");
  const dhlShip = trackingResMulti.shipments.find((s) => s.provider.name === "DHL");
  assert(!!dtdcShip && !!dhlShip, "Both DTDC and DHL shipments are present in response");
  assert(dtdcShip?.status === "PICKED_UP", "DTDC shipment has status PICKED_UP");
  assert(dhlShip?.status === "OUT_FOR_DELIVERY", "DHL shipment has status OUT_FOR_DELIVERY");

  // -------------------------------------------------------------
  // TEST 5: Shipment -> OrderItem Mapping per Warehouse
  // -------------------------------------------------------------
  console.log("\n[Test 5] Shipment -> OrderItem Strict Warehouse Mapping");
  assert(dtdcShip?.items.length === 1, "DTDC shipment has exactly 1 item group");
  assert(dtdcShip?.items[0].title === "Delhi Bracket Pack", "DTDC shipment mapped the Delhi item");
  assert(dtdcShip?.items[0].quantity === 3, "DTDC shipment item quantity is 3");

  assert(dhlShip?.items.length === 1, "DHL shipment has exactly 1 item group");
  assert(dhlShip?.items[0].title === "Mumbai Bracket Pack", "DHL shipment mapped the Mumbai item");
  assert(dhlShip?.items[0].quantity === 6, "DHL shipment item quantity is 6");

  // -------------------------------------------------------------
  // TEST 6: Shipment Without Tracking Number
  // -------------------------------------------------------------
  console.log("\n[Test 6] Shipment Without Tracking Number Handled Cleanly");
  const orderUnassigned = await prisma.order.create({
    data: {
      orderNumber: `ORD-UNTRK-${timestamp}`,
      customerName: "Alice Tracker",
      customerEmail: customerA.email,
      customerId: customerA.id,
      countryId: country.id,
      currencyId: currency.id,
      shippingAddress: { city: "Delhi", state: "Delhi", countryCode: "IN" },
      subtotal: 500,
      total: 500,
      status: "PROCESSING",
      paymentStatus: "PAID",
    },
  });

  await prisma.shipment.create({
    data: {
      orderId: orderUnassigned.id,
      providerId: dtdcProvider.id,
      warehouseId: warehouseDelhi.id,
      status: "CREATED",
      trackingNumber: null,
      awbNumber: null,
    },
  });

  const trackingResUntracked = await getCustomerOrderTracking(customerA.id, orderUnassigned.id);
  assert(trackingResUntracked.shipments.length === 1, "Shipment is returned even without tracking number");
  assert(trackingResUntracked.shipments[0].trackingNumber === null, "trackingNumber is null");
  assert(trackingResUntracked.shipments[0].awbNumber === null, "awbNumber is null");
  assert(trackingResUntracked.shipments[0].trackingUrl === null, "trackingUrl is null");
  assert(trackingResUntracked.shipments[0].status === "CREATED", "status is CREATED");
  assert(trackingResUntracked.shipments[0].statusLabel === "Order Confirmed", "statusLabel is 'Order Confirmed'");

  // -------------------------------------------------------------
  // TEST 7: Order With No Shipments
  // -------------------------------------------------------------
  console.log("\n[Test 7] Order With No Shipments Returns Valid Empty Collection");
  const orderEmptyShipments = await prisma.order.create({
    data: {
      orderNumber: `ORD-NOSHIP-${timestamp}`,
      customerName: "Alice Tracker",
      customerEmail: customerA.email,
      customerId: customerA.id,
      countryId: country.id,
      currencyId: currency.id,
      shippingAddress: { city: "Delhi", state: "Delhi", countryCode: "IN" },
      subtotal: 500,
      total: 500,
      status: "PENDING",
      paymentStatus: "PENDING",
    },
  });

  const trackingResEmpty = await getCustomerOrderTracking(customerA.id, orderEmptyShipments.id);
  assert(trackingResEmpty.orderId === orderEmptyShipments.id, "Returns correct orderId for order with no shipments");
  assert(trackingResEmpty.isMultiShipment === false, "isMultiShipment is false");
  assert(Array.isArray(trackingResEmpty.shipments) && trackingResEmpty.shipments.length === 0, "shipments is an empty array");

  // -------------------------------------------------------------
  // TEST 8: Event Chronological Ordering (Ascending)
  // -------------------------------------------------------------
  console.log("\n[Test 8] Event Chronological Ordering (Oldest to Newest)");
  const shipEventTest = await prisma.shipment.create({
    data: {
      orderId: order1.id,
      providerId: dhlProvider.id,
      trackingNumber: `DHL-ORD-${timestamp}`,
      status: "DELIVERED",
    },
  });

  const tBase = Date.now();
  await prisma.shipmentEvent.createMany({
    data: [
      { shipmentId: shipEventTest.id, status: "DELIVERED", timestamp: new Date(tBase + 30000), description: "Delivered to recipient" },
      { shipmentId: shipEventTest.id, status: "OUT_FOR_DELIVERY", timestamp: new Date(tBase + 20000), description: "Out for delivery" },
      { shipmentId: shipEventTest.id, status: "PICKED_UP", timestamp: new Date(tBase + 10000), description: "Picked up" },
    ],
  });

  const trackingOrderRes = await getCustomerOrderTracking(customerA.id, order1.id);
  const targetShipment = trackingOrderRes.shipments.find((s) => s.shipmentId === shipEventTest.id);
  assert(targetShipment?.events.length === 3, "Shipment has 3 events");
  assert(targetShipment?.events[0].status === "PICKED_UP", "1st event is PICKED_UP (oldest)");
  assert(targetShipment?.events[1].status === "OUT_FOR_DELIVERY", "2nd event is OUT_FOR_DELIVERY");
  assert(targetShipment?.events[2].status === "DELIVERED", "3rd event is DELIVERED (newest)");

  // -------------------------------------------------------------
  // TEST 9: Event Deduplication on Repeated Ingestion
  // -------------------------------------------------------------
  console.log("\n[Test 9] Event Deduplication on Repeated Ingestion");
  const testAdapter: ShippingProviderAdapter = {
    name: "TEST_COURIER",
    async testConnection() { return { success: true, message: "OK", latencyMs: 1 }; },
    async getRates() { return []; },
    async createShipment() { return { success: true }; },
    async trackShipment(_c, trackingNumber) {
      return {
        trackingNumber,
        status: "IN_TRANSIT",
        updates: [
          { status: "LABEL_GENERATED", location: "Facility A", timestamp: "2026-08-22T10:00:00.000Z", description: "Created" },
          { status: "PICKED_UP", location: "Facility A", timestamp: "2026-08-22T12:00:00.000Z", description: "Picked up" },
          { status: "IN_TRANSIT", location: "Facility B", timestamp: "2026-08-22T15:00:00.000Z", description: "In transit" },
        ],
      };
    },
  };
  registerAdapter("TEST_COURIER", testAdapter);

  const testProvider = await prisma.shippingProvider.upsert({
    where: { name: "TEST_COURIER" },
    update: { isEnabled: true },
    create: { name: "TEST_COURIER", displayName: "Test Courier", isEnabled: true },
  });

  const dedupShipment = await prisma.shipment.create({
    data: {
      orderId: order1.id,
      providerId: testProvider.id,
      trackingNumber: `TEST-DEDUP-${timestamp}`,
      status: "CREATED",
    },
  });

  // First sync pass: ingests 3 events
  await trackShipmentFromProvider(dedupShipment.id);
  const eventsCountPass1 = await prisma.shipmentEvent.count({ where: { shipmentId: dedupShipment.id } });
  assert(eventsCountPass1 === 3, `First track ingestion created 3 events (got ${eventsCountPass1})`);

  // Second sync pass: repeated response must skip duplicates
  await trackShipmentFromProvider(dedupShipment.id);
  const eventsCountPass2 = await prisma.shipmentEvent.count({ where: { shipmentId: dedupShipment.id } });
  assert(eventsCountPass2 === 3, `Repeated track ingestion did NOT duplicate events (count remained ${eventsCountPass2})`);

  // -------------------------------------------------------------
  // TEST 10: Provider Tracking URL Template Generation
  // -------------------------------------------------------------
  console.log("\n[Test 10] Provider Tracking URL Template Generation");
  const urlWithTemplate = buildTrackingUrl("https://www.dtdc.in/tracking/{tracking}", "AWB12345", null);
  assert(urlWithTemplate === "https://www.dtdc.in/tracking/AWB12345", "Tracking URL template replaced correctly");

  const urlWithAwb = buildTrackingUrl("https://track.dhl.com/{tracking}", null, "DHL98765");
  assert(urlWithAwb === "https://track.dhl.com/DHL98765", "Tracking URL uses AWB when trackingNumber is null");

  const urlWithoutTemplate = buildTrackingUrl(null, "AWB12345", null);
  assert(urlWithoutTemplate === null, "Tracking URL is null when no template configured");

  // -------------------------------------------------------------
  // TEST 11: Tracking Status Normalization & Labels
  // -------------------------------------------------------------
  console.log("\n[Test 11] Tracking Status Normalization & Customer Labels");
  assert(getShipmentStatusLabel("CREATED") === "Order Confirmed", "CREATED maps to 'Order Confirmed'");
  assert(getShipmentStatusLabel("LABEL_GENERATED") === "Shipment Prepared", "LABEL_GENERATED maps to 'Shipment Prepared'");
  assert(getShipmentStatusLabel("PICKED_UP") === "Picked Up", "PICKED_UP maps to 'Picked Up'");
  assert(getShipmentStatusLabel("IN_TRANSIT") === "In Transit", "IN_TRANSIT maps to 'In Transit'");
  assert(getShipmentStatusLabel("OUT_FOR_DELIVERY") === "Out for Delivery", "OUT_FOR_DELIVERY maps to 'Out for Delivery'");
  assert(getShipmentStatusLabel("DELIVERED") === "Delivered", "DELIVERED maps to 'Delivered'");
  assert(getShipmentStatusLabel("FAILED") === "Delivery Exception", "FAILED maps to 'Delivery Exception'");
  assert(getShipmentStatusLabel("RETURNED") === "Returned", "RETURNED maps to 'Returned'");
  assert(getShipmentStatusLabel("CANCELLED") === "Cancelled", "CANCELLED maps to 'Cancelled'");

  // -------------------------------------------------------------
  // TEST 12: Zero Physical Stock & Zero Reserved Stock Mutation
  // -------------------------------------------------------------
  console.log("\n[Test 12] Zero Inventory Mutation During Tracking Operations");
  const invDelhiAfter = await prisma.inventory.findUnique({ where: { id: invDelhi.id } });
  const invMumbaiAfter = await prisma.inventory.findUnique({ where: { id: invMumbai.id } });

  assert(invDelhiAfter?.stock === 50, "Delhi warehouse physical stock unchanged at 50");
  assert(invDelhiAfter?.reservedStock === 0, "Delhi warehouse reserved stock unchanged at 0");
  assert(invMumbaiAfter?.stock === 50, "Mumbai warehouse physical stock unchanged at 50");
  assert(invMumbaiAfter?.reservedStock === 0, "Mumbai warehouse reserved stock unchanged at 0");

  // -------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------
  console.log("\n=======================================================");
  console.log(`  CUSTOMER TRACKING SUITE COMPLETE: ${passed} Passed, ${failed} Failed`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runCustomerTrackingTests()
  .catch((err) => {
    console.error("FATAL in test runner:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
