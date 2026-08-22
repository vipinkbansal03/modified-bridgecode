import { prisma } from "../config/database";
import { reserveOrderInventory, commitOrderReservation, releaseOrderReservation } from "../modules/inventory/inventoryReservation.service";
import { reconcilePaymentSuccess, reconcilePaymentFailure, expireOrderAndReleaseStock, getPaymentSession } from "../modules/payment/paymentReconciliation.service";

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

async function runPaymentLifecycleTests() {
  console.log("\n=======================================================");
  console.log("  PHASE 2: RAZORPAY PAYMENT LIFECYCLE REGRESSION SUITE");
  console.log("=======================================================\n");

  // 1. Setup country & currency
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

  const customer = await prisma.customer.upsert({
    where: { email: "payment_test_user@modernortho.com" },
    update: { status: "ACTIVE" },
    create: {
      email: "payment_test_user@modernortho.com",
      passwordHash: "dummy",
      firstName: "Dr. Payment",
      lastName: "Tester",
      phone: "+919999988888",
      defaultCountryId: country.id,
      status: "ACTIVE",
    },
  });

  // Create physical warehouses
  const warehouseDelhi = await prisma.warehouse.create({
    data: {
      name: `Delhi Warehouse ${Date.now()}`,
      countryId: country.id,
      state: "Delhi",
      city: "New Delhi",
      status: "ACTIVE",
    },
  });

  const warehouseMumbai = await prisma.warehouse.create({
    data: {
      name: `Mumbai Warehouse ${Date.now()}`,
      countryId: country.id,
      state: "Maharashtra",
      city: "Mumbai",
      status: "ACTIVE",
    },
  });

  // Create test product and variant
  const product = await prisma.product.create({
    data: {
      title: "Test Ortho Bracket Pro",
      slug: `test-bracket-pro-${Date.now()}`,
      sku: `BRK-PRO-${Date.now()}`,
      hsnCode: "90211000",
      status: "ACTIVE",
      categoryId: category.id,
      defaultCountryId: country.id,
    },
  });

  const variant = await prisma.productVariant.create({
    data: {
      productId: product.id,
      title: "0.022 Slot MBT",
      sku: `VAR-MBT-${Date.now()}`,
      variantKey: `reg-var-mbt-${Date.now()}`,
      status: "ACTIVE",
    },
  });

  // Create warehouse inventory stock
  const invDelhi = await prisma.inventory.create({
    data: {
      productId: product.id,
      variantId: variant.id,
      warehouseId: warehouseDelhi.id,
      stock: 100,
      reservedStock: 0,
      lowStockThreshold: 10,
    },
  });

  const invMumbai = await prisma.inventory.create({
    data: {
      productId: product.id,
      variantId: variant.id,
      warehouseId: warehouseMumbai.id,
      stock: 100,
      reservedStock: 0,
      lowStockThreshold: 10,
    },
  });

  // -------------------------------------------------------------
  // TEST 1: New Checkout & Single Payment Initiation
  // -------------------------------------------------------------
  console.log("\n[Test 1] Order Creation + Single Payment Initiation");
  const expiresAt4Min = new Date(Date.now() + 4 * 60 * 1000);
  const order1 = await prisma.order.create({
    data: {
      orderNumber: `ORD-PAY-1-${Date.now()}`,
      customerName: "Dr. Payment Tester",
      customerEmail: customer.email,
      customerId: customer.id,
      countryId: country.id,
      currencyId: currency.id,
      shippingAddress: { city: "New Delhi", state: "Delhi", countryCode: "IN" },
      subtotal: 5000,
      total: 5000,
      status: "PENDING",
      paymentStatus: "PENDING",
      paymentMethod: "RAZORPAY",
      paymentExpiresAt: expiresAt4Min,
      items: {
        create: [
          {
            productId: product.id,
            variantId: variant.id,
            title: "Test Bracket",
            quantity: 5,
            unitPrice: 1000,
            total: 5000,
            warehouseId: warehouseDelhi.id,
          },
        ],
      },
    },
    include: { items: true },
  });

  await reserveOrderInventory(order1.id);

  // Check inventory reserved
  const invDelhiAfterRes = await prisma.inventory.findUnique({ where: { id: invDelhi.id } });
  assert(invDelhiAfterRes?.reservedStock === 5, "Delhi inventory reservedStock increased to 5");
  assert(invDelhiAfterRes?.stock === 100, "Delhi inventory physical stock remains 100");

  // Create single PaymentTransaction attempt #1
  const gatewayOrderId1 = `order_test_A1_${Date.now()}`;
  const tx1 = await prisma.paymentTransaction.create({
    data: {
      orderId: order1.id,
      attemptNumber: 1,
      paymentMethod: "RAZORPAY",
      provider: "RAZORPAY",
      gatewayOrderId: gatewayOrderId1,
      status: "PENDING",
      amount: order1.total,
      currency: "INR",
      metadata: { receipt: order1.orderNumber },
    },
  });

  assert(tx1.attemptNumber === 1, "PaymentTransaction created as Attempt #1");
  assert(tx1.status === "PENDING", "PaymentTransaction status is PENDING");

  // -------------------------------------------------------------
  // TEST 2: Payment Success Reconciliation (Zero Stock Commit)
  // -------------------------------------------------------------
  console.log("\n[Test 2] Payment Success Reconciliation");
  const gatewayPaymentId1 = `pay_test_P1_${Date.now()}`;
  const successRes = await reconcilePaymentSuccess({
    orderId: order1.id,
    gatewayOrderId: gatewayOrderId1,
    gatewayPaymentId: gatewayPaymentId1,
    gatewaySignature: "valid_test_signature",
    provider: "RAZORPAY",
  });

  assert(successRes.order.paymentStatus === "PAID", "Order paymentStatus transitioned to PAID");
  assert(successRes.order.status === "PROCESSING", "Order status transitioned to PROCESSING");
  assert(successRes.transaction?.status === "SUCCESS", "PaymentTransaction updated to SUCCESS");
  assert(successRes.transaction?.gatewayPaymentId === gatewayPaymentId1, "PaymentTransaction records gatewayPaymentId");

  const invAfterPaySuccess = await prisma.inventory.findUnique({ where: { id: invDelhi.id } });
  assert(invAfterPaySuccess?.stock === 100, "Physical stock remains 100 (NOT committed at payment)");
  assert(invAfterPaySuccess?.reservedStock === 5, "Reserved stock remains 5");

  // -------------------------------------------------------------
  // TEST 3: Webhook Idempotency (Duplicate payment.captured)
  // -------------------------------------------------------------
  console.log("\n[Test 3] Webhook Idempotency on Duplicate Captured Event");
  const dupSuccessRes = await reconcilePaymentSuccess({
    gatewayOrderId: gatewayOrderId1,
    gatewayPaymentId: gatewayPaymentId1,
    provider: "RAZORPAY",
  });
  assert(dupSuccessRes.alreadyProcessed === true, "Duplicate payment.captured returns alreadyProcessed: true (No-Op)");

  // -------------------------------------------------------------
  // TEST 4: Shipment Commit from Exact Reserved Warehouse
  // -------------------------------------------------------------
  console.log("\n[Test 4] Shipment Dispatch Commits Reserved Warehouse Stock");
  await commitOrderReservation(order1.id);
  const invAfterShipment = await prisma.inventory.findUnique({ where: { id: invDelhi.id } });
  assert(invAfterShipment?.stock === 95, "Physical stock decremented to 95 at shipment");
  assert(invAfterShipment?.reservedStock === 0, "Reserved stock decremented to 0 at shipment");

  const invMumbaiUntouched = await prisma.inventory.findUnique({ where: { id: invMumbai.id } });
  assert(invMumbaiUntouched?.stock === 100 && invMumbaiUntouched?.reservedStock === 0, "Mumbai warehouse remains 100% untouched");

  // -------------------------------------------------------------
  // TEST 5: Payment Failure & Retry on Same Order (Attempt #2)
  // -------------------------------------------------------------
  console.log("\n[Test 5] Payment Failure & Retry Attempt #2 on Same Internal Order");
  const order2 = await prisma.order.create({
    data: {
      orderNumber: `ORD-PAY-2-${Date.now()}`,
      customerName: "Dr. Payment Tester",
      customerEmail: customer.email,
      customerId: customer.id,
      countryId: country.id,
      currencyId: currency.id,
      shippingAddress: { city: "Mumbai", state: "Maharashtra", countryCode: "IN" },
      subtotal: 3000,
      total: 3000,
      status: "PENDING",
      paymentStatus: "PENDING",
      paymentMethod: "RAZORPAY",
      paymentExpiresAt: new Date(Date.now() + 4 * 60 * 1000),
      items: {
        create: [
          {
            productId: product.id,
            variantId: variant.id,
            title: "Test Bracket",
            quantity: 3,
            unitPrice: 1000,
            total: 3000,
            warehouseId: warehouseMumbai.id,
          },
        ],
      },
    },
  });

  await reserveOrderInventory(order2.id);

  const gatewayOrderId2_A1 = `order_test_2_A1_${Date.now()}`;
  await prisma.paymentTransaction.create({
    data: {
      orderId: order2.id,
      attemptNumber: 1,
      paymentMethod: "RAZORPAY",
      provider: "RAZORPAY",
      gatewayOrderId: gatewayOrderId2_A1,
      status: "PENDING",
      amount: order2.total,
      currency: "INR",
    },
  });

  // Record failure on Attempt #1
  const failRes = await reconcilePaymentFailure({
    orderId: order2.id,
    gatewayOrderId: gatewayOrderId2_A1,
    errorCode: "BAD_REQUEST_ERROR",
    errorMessage: "Customer card declined by bank",
    provider: "RAZORPAY",
  });

  assert(failRes?.transaction?.status === "FAILED", "Attempt #1 marked FAILED");
  assert(failRes?.order?.status === "PENDING", "Order status remains PENDING for retry");

  const invMumbaiAfterFail = await prisma.inventory.findUnique({ where: { id: invMumbai.id } });
  assert(invMumbaiAfterFail?.reservedStock === 3, "Warehouse reservation remains ACTIVE after payment attempt failure");

  // Create Attempt #2 on the same internal Order
  const lastTxOrder2 = await prisma.paymentTransaction.findFirst({
    where: { orderId: order2.id },
    orderBy: { attemptNumber: "desc" },
  });
  const nextAttemptNum = (lastTxOrder2?.attemptNumber ?? 0) + 1;
  assert(nextAttemptNum === 2, "Computed next attempt number is strictly 2");

  const gatewayOrderId2_A2 = `order_test_2_A2_${Date.now()}`;
  const tx2_A2 = await prisma.paymentTransaction.create({
    data: {
      orderId: order2.id,
      attemptNumber: nextAttemptNum,
      paymentMethod: "RAZORPAY",
      provider: "RAZORPAY",
      gatewayOrderId: gatewayOrderId2_A2,
      status: "PENDING",
      amount: order2.total,
      currency: "INR",
      metadata: { receipt: `${order2.orderNumber}-A2` },
    },
  });

  assert(tx2_A2.attemptNumber === 2, "Created PaymentTransaction Attempt #2 on SAME order");
  assert(tx2_A2.orderId === order2.id, "Attempt #2 references the same internal Order ID");

  // Complete Attempt #2
  const payId2 = `pay_test_2_success_${Date.now()}`;
  const success2 = await reconcilePaymentSuccess({
    orderId: order2.id,
    gatewayOrderId: gatewayOrderId2_A2,
    gatewayPaymentId: payId2,
    provider: "RAZORPAY",
  });
  assert(success2.order.paymentStatus === "PAID", "Order 2 successfully transitioned to PAID on Attempt #2");

  // -------------------------------------------------------------
  // TEST 6: Payment Expiration & Automatic Stock Release
  // -------------------------------------------------------------
  console.log("\n[Test 6] 4-Minute Expiration & Atomic Reservation Release");
  const expiredTimestamp = new Date(Date.now() - 1000); // 1 sec in past
  const order3 = await prisma.order.create({
    data: {
      orderNumber: `ORD-EXP-3-${Date.now()}`,
      customerName: "Dr. Payment Tester",
      customerEmail: customer.email,
      customerId: customer.id,
      countryId: country.id,
      currencyId: currency.id,
      shippingAddress: { city: "Delhi", state: "Delhi", countryCode: "IN" },
      subtotal: 2000,
      total: 2000,
      status: "PENDING",
      paymentStatus: "PENDING",
      paymentMethod: "RAZORPAY",
      paymentExpiresAt: expiredTimestamp,
      items: {
        create: [
          {
            productId: product.id,
            variantId: variant.id,
            title: "Test Bracket",
            quantity: 2,
            unitPrice: 1000,
            total: 2000,
            warehouseId: warehouseDelhi.id,
          },
        ],
      },
    },
  });

  await reserveOrderInventory(order3.id);
  const invDelhiDuringOrder3 = await prisma.inventory.findUnique({ where: { id: invDelhi.id } });
  assert(invDelhiDuringOrder3?.reservedStock === 2, "Order 3 reserved 2 units in Delhi warehouse");

  const gwExpId = `order_exp_tx_${Date.now()}`;
  await prisma.paymentTransaction.create({
    data: {
      orderId: order3.id,
      attemptNumber: 1,
      paymentMethod: "RAZORPAY",
      provider: "RAZORPAY",
      gatewayOrderId: gwExpId,
      status: "PENDING",
      amount: 2000,
      currency: "INR",
    },
  });

  // Run atomic expiration release
  const expOrder = await expireOrderAndReleaseStock(order3.id);
  assert(expOrder?.status === "CANCELLED", "Expired order status transitioned to CANCELLED");
  assert(expOrder?.paymentStatus === "FAILED", "Expired order paymentStatus transitioned to FAILED");

  const invDelhiAfterExp = await prisma.inventory.findUnique({ where: { id: invDelhi.id } });
  assert(invDelhiAfterExp?.reservedStock === 0, "Delhi reservedStock was atomically released back to 0");

  const expTx = await prisma.paymentTransaction.findFirst({ where: { gatewayOrderId: gwExpId } });
  assert(expTx?.status === "EXPIRED", "Open PaymentTransaction was marked EXPIRED");

  // -------------------------------------------------------------
  // TEST 7: Payment Session Recovery State
  // -------------------------------------------------------------
  console.log("\n[Test 7] Payment Session Recovery & Countdown State");
  const sessionData = await getPaymentSession(customer.id, order2.id);
  assert(sessionData.orderId === order2.id, "Session retrieved correct orderId");
  assert(sessionData.paymentStatus === "PAID", "Session reports accurate paymentStatus");
  assert(sessionData.items.length === 1, "Session accurately lists order items and assigned warehouse");
  assert(sessionData.items[0].warehouseId === warehouseMumbai.id, "Session preserves assigned warehouseId");

  // -------------------------------------------------------------
  // TEST 8: Late Webhook After Expiry
  // -------------------------------------------------------------
  console.log("\n[Test 8] Late Captured Webhook on Expired Order");
  const lateCaptureRes = await reconcilePaymentSuccess({
    orderId: order3.id,
    gatewayOrderId: gwExpId,
    gatewayPaymentId: `pay_late_${Date.now()}`,
    provider: "RAZORPAY",
  });
  assert(lateCaptureRes.transaction?.status === "SUCCESS", "Late captured webhook records SUCCESS in transaction ledger");
  assert(lateCaptureRes.order.paymentStatus === "PAID", "Late captured order updated to PAID for reconciliation");

  // -------------------------------------------------------------
  // TEST 9: No Early Expiry (Strict 4-Minute Window Boundary)
  // -------------------------------------------------------------
  console.log("\n[Test 9] No Early Expiry - Order Valid For Full 4 Minutes");
  const t0 = Date.now();
  const unexpiredOrder = await prisma.order.create({
    data: {
      orderNumber: `ORD-TIMING-${t0}`,
      customerName: "Dr. Payment Tester",
      customerEmail: customer.email,
      customerId: customer.id,
      countryId: country.id,
      currencyId: currency.id,
      shippingAddress: { city: "Delhi", state: "Delhi", countryCode: "IN" },
      subtotal: 1000,
      total: 1000,
      status: "PENDING",
      paymentStatus: "PENDING",
      paymentMethod: "RAZORPAY",
      paymentExpiresAt: new Date(t0 + 4 * 60 * 1000),
      items: {
        create: [
          {
            productId: product.id,
            variantId: variant.id,
            title: "Test Bracket",
            quantity: 1,
            unitPrice: 1000,
            total: 1000,
            warehouseId: warehouseDelhi.id,
          },
        ],
      },
    },
  });

  await reserveOrderInventory(unexpiredOrder.id);
  const invBeforeExpiry = await prisma.inventory.findUnique({ where: { id: invDelhi.id } });
  assert(invBeforeExpiry?.reservedStock === 1, "Reservation is active immediately upon order creation");

  // Verify before paymentExpiresAt, order is not expired and remains retryable
  const sessionBeforeExp = await getPaymentSession(customer.id, unexpiredOrder.id);
  assert(sessionBeforeExp.isExpired === false, "Session isExpired is FALSE before expiry timestamp");
  assert(sessionBeforeExp.isRetryable === true, "Session isRetryable is TRUE before expiry timestamp");
  assert(sessionBeforeExp.status === "PENDING", "Order status remains PENDING");
  assert(sessionBeforeExp.secondsRemaining >= 235 && sessionBeforeExp.secondsRemaining <= 240, `secondsRemaining is accurate (~240s remaining, got ${sessionBeforeExp.secondsRemaining}s)`);

  // -------------------------------------------------------------
  // TEST 10: Worker Timing (Never Early)
  // -------------------------------------------------------------
  console.log("\n[Test 10] Background Worker Never Expires Orders Early");
  const { processExpiredOrders } = await import("../modules/payment/paymentReconciliation.service");
  const expiredCount = await processExpiredOrders();
  const checkUnexpiredOrder = await prisma.order.findUnique({ where: { id: unexpiredOrder.id } });
  assert(checkUnexpiredOrder?.status === "PENDING", "Worker did NOT expire order before its paymentExpiresAt");
  assert(checkUnexpiredOrder?.paymentStatus === "PENDING", "Worker did NOT mutate paymentStatus before paymentExpiresAt");

  const invStillReserved = await prisma.inventory.findUnique({ where: { id: invDelhi.id } });
  assert(invStillReserved?.reservedStock === 1, "Worker did NOT release reservation before paymentExpiresAt");

  // -------------------------------------------------------------
  // TEST 11: Accurate Countdown & Exact Expiry Boundary
  // -------------------------------------------------------------
  console.log("\n[Test 11] Accurate Countdown and Exact Expiry Boundary");
  const simulatedTimeRemaining = Math.max(0, Math.floor((unexpiredOrder.paymentExpiresAt!.getTime() - Date.now()) / 1000));
  const liveSession = await getPaymentSession(customer.id, unexpiredOrder.id);
  const diff = Math.abs(liveSession.secondsRemaining - simulatedTimeRemaining);
  assert(diff <= 1, `Server secondsRemaining (${liveSession.secondsRemaining}s) matches mathematical time delta within 1s tolerance`);

  // -------------------------------------------------------------
  // TEST 12: Reconciliation After Backend Expiry
  // -------------------------------------------------------------
  console.log("\n[Test 12] Immediate Reconciliation After Backend Expiry");
  // Fast-forward order's paymentExpiresAt to 1 second in the past
  await prisma.order.update({
    where: { id: unexpiredOrder.id },
    data: { paymentExpiresAt: new Date(Date.now() - 1000) },
  });

  const sessionAfterExp = await getPaymentSession(customer.id, unexpiredOrder.id);
  assert(sessionAfterExp.isExpired === true, "Session immediately reports isExpired: true");
  assert(sessionAfterExp.isRetryable === false, "Session immediately reports isRetryable: false (disables Retry UI)");
  assert(sessionAfterExp.status === "CANCELLED", "Order status transitioned to CANCELLED");
  assert(sessionAfterExp.paymentStatus === "FAILED", "Order paymentStatus transitioned to FAILED");

  // -------------------------------------------------------------
  // TEST 13: Scheduler Expiry with Prior Failed Attempt
  // -------------------------------------------------------------
  console.log("\n[Test 13] Scheduler Expiry Releases Reservation Even After Attempt Failure");
  const orderWithFail = await prisma.order.create({
    data: {
      orderNumber: `ORD-EXP-FAIL-${Date.now()}`,
      customerName: "Dr. Payment Tester",
      customerEmail: customer.email,
      customerId: customer.id,
      countryId: country.id,
      currencyId: currency.id,
      shippingAddress: { city: "Delhi", state: "Delhi", countryCode: "IN" },
      subtotal: 1000,
      total: 1000,
      status: "PENDING",
      paymentStatus: "PENDING",
      paymentMethod: "RAZORPAY",
      paymentExpiresAt: new Date(Date.now() + 4 * 60 * 1000), // Active 4-min window
      items: {
        create: [
          {
            productId: product.id,
            variantId: variant.id,
            title: "Test Bracket",
            quantity: 3,
            unitPrice: 1000,
            total: 3000,
            warehouseId: warehouseDelhi.id,
          },
        ],
      },
    },
  });

  await reserveOrderInventory(orderWithFail.id);
  const invDuringFail = await prisma.inventory.findUnique({ where: { id: invDelhi.id } });
  assert(invDuringFail?.reservedStock === 3, "Inventory reserved 3 units for order before failure");

  // Record payment failure during active window (order stays PENDING for retry)
  const failOutcome = await reconcilePaymentFailure({
    orderId: orderWithFail.id,
    errorCode: "GATEWAY_ERROR",
    errorMessage: "Simulated attempt decline",
  });
  assert(failOutcome?.order?.status === "PENDING", "Order stays PENDING for retry after attempt failure");

  // Fast-forward paymentExpiresAt to simulate 4-minute timeout passing
  await prisma.order.update({
    where: { id: orderWithFail.id },
    data: { paymentExpiresAt: new Date(Date.now() - 1000) },
  });

  // Run scheduler pass
  const countAfterFail = await processExpiredOrders();
  assert(countAfterFail >= 1, "Scheduler found and processed the expired order with failed attempt");

  const invAfterSchedulerPass = await prisma.inventory.findUnique({ where: { id: invDelhi.id } });
  assert(invAfterSchedulerPass?.reservedStock === 0, "Warehouse reservation released to 0 by scheduler after attempt failure");

  // -------------------------------------------------------------
  // TEST 14: Base Inventory Expiry Release (warehouseId = null)
  // -------------------------------------------------------------
  console.log("\n[Test 14] Base Inventory Expiry Release (warehouseId = null)");
  // Create Base inventory record
  let invBase = await prisma.inventory.findFirst({
    where: { productId: product.id, variantId: variant.id, warehouseId: null },
  });
  if (!invBase) {
    invBase = await prisma.inventory.create({
      data: {
        productId: product.id,
        variantId: variant.id,
        warehouseId: null,
        stock: 50,
        reservedStock: 0,
      },
    });
  }

  const baseOrder = await prisma.order.create({
    data: {
      orderNumber: `ORD-EXP-BASE-${Date.now()}`,
      customerName: "Dr. Payment Tester",
      customerEmail: customer.email,
      customerId: customer.id,
      countryId: country.id,
      currencyId: currency.id,
      shippingAddress: { city: "Remote", state: "StateX", countryCode: "IN" },
      subtotal: 1000,
      total: 1000,
      status: "PENDING",
      paymentStatus: "PENDING",
      paymentMethod: "RAZORPAY",
      paymentExpiresAt: new Date(Date.now() - 1000), // Expired
      items: {
        create: [
          {
            productId: product.id,
            variantId: variant.id,
            title: "Test Bracket Base",
            quantity: 4,
            unitPrice: 1000,
            total: 4000,
            warehouseId: null, // Strict Base Inventory
          },
        ],
      },
    },
  });

  await reserveOrderInventory(baseOrder.id);
  const invBaseReserved = await prisma.inventory.findUnique({ where: { id: invBase.id } });
  assert(invBaseReserved?.reservedStock === 4, "Base Inventory strictly reserved 4 units");

  // Release via expireOrderAndReleaseStock
  await expireOrderAndReleaseStock(baseOrder.id);
  const invBaseReleased = await prisma.inventory.findUnique({ where: { id: invBase.id } });
  assert(invBaseReleased?.reservedStock === 0, "Base Inventory reservedStock released strictly back to 0");

  const invPhysicalDelhiCheck = await prisma.inventory.findUnique({ where: { id: invDelhi.id } });
  assert(invPhysicalDelhiCheck?.reservedStock === 0, "Physical Delhi warehouse was untouched by Base release");

  // -------------------------------------------------------------
  // TEST 15: Expiry Release Idempotency
  // -------------------------------------------------------------
  console.log("\n[Test 15] Expiry Release Idempotency");
  const invBeforeDoubleExp = await prisma.inventory.findUnique({ where: { id: invBase.id } });
  await expireOrderAndReleaseStock(baseOrder.id); // Second execution
  const invAfterDoubleExp = await prisma.inventory.findUnique({ where: { id: invBase.id } });
  assert(invBeforeDoubleExp?.reservedStock === invAfterDoubleExp?.reservedStock, "Repeated expiration call is strictly idempotent");

  // -------------------------------------------------------------
  // TEST 16: Zero Physical Stock Mutation Upon Expiry
  // -------------------------------------------------------------
  console.log("\n[Test 16] Zero Physical Stock Mutation Upon Expiry");
  assert(invBaseReleased?.stock === 50, "Physical stock remains 50 (zero physical stock decrement upon expiry)");

  // -------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------
  console.log("\n=======================================================");
  console.log(`  PHASE 2 REGRESSION SUITE COMPLETE: ${passed} Passed, ${failed} Failed`);
  console.log("=======================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runPaymentLifecycleTests()
  .catch((err) => {
    console.error("FATAL in test runner:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
