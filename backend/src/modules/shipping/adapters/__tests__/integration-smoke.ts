/**
 * Shipping Adapter Integration Smoke Test
 * Run: npx ts-node --transpile-only src/modules/shipping/adapters/__tests__/integration-smoke.ts
 *
 * Uses REAL API credentials from environment variables.
 * Tests: connection → create shipment → track → cancel (if possible)
 *
 * Required env vars (set before running):
 *   DHL_API_KEY, DHL_API_SECRET, DHL_BASE_URL
 *   DTDC_API_KEY, DTDC_BASE_URL
 */

import { dhlAdapter } from "../dhl.adapter";
import { dtdcAdapter } from "../dtdc.adapter";
import type { ShippingProviderCredentials } from "../types";

const TIMEOUT = 30_000;

function header(text: string) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  ${text}`);
  console.log(`${"═".repeat(60)}`);
}

function subHeader(text: string) {
  console.log(`\n  ── ${text} ──`);
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ═══════════════════════════════════════════════════════════
// DHL Integration Tests
// ═══════════════════════════════════════════════════════════
async function testDHL() {
  header("DHL Integration Test");

  const creds: ShippingProviderCredentials = {
    apiKey: process.env.DHL_API_KEY ?? "",
    apiSecret: process.env.DHL_API_SECRET ?? "",
    baseUrl: process.env.DHL_BASE_URL ?? "https://api-test.dhl.com/mydhlapi",
  };

  if (!creds.apiKey) {
    console.log("  ⚠ DHL_API_KEY not set — skipping DHL tests.");
    console.log("  Set env vars: DHL_API_KEY, DHL_API_SECRET, DHL_BASE_URL");
    return;
  }

  console.log(`  Base URL: ${creds.baseUrl}`);
  console.log(`  API Key:  ${creds.apiKey.slice(0, 6)}****`);

  // 1. Connection test
  subHeader("1. testConnection");
  const connResult = await dhlAdapter.testConnection(creds);
  console.log(`  Success: ${connResult.success}`);
  console.log(`  Message: ${connResult.message}`);
  console.log(`  Latency: ${connResult.latencyMs}ms`);

  if (!connResult.success) {
    console.log("  ✗ Connection failed — skipping remaining DHL tests.");
    return;
  }

  // 2. Get rates
  subHeader("2. getRates");
  const rates = await dhlAdapter.getRates(creds, {
    countryCode: "US",
    orderTotal: 5000,
    weight: 2,
  });
  console.log(`  Rates returned: ${rates.length}`);
  rates.forEach((r) => console.log(`    - ${r.service}: ${r.currency} ${r.charge} (${r.estimatedDays})`));

  // 3. Create shipment
  subHeader("3. createShipment");
  const shipResult = await dhlAdapter.createShipment(creds, {
    orderNumber: `SMOKE-${Date.now()}`,
    recipientName: "Smoke Test Recipient",
    recipientEmail: "smoke-test@example.com",
    address: {
      line1: "123 Test Street",
      city: "Mumbai",
      postalCode: "400001",
    },
    countryCode: "IN",
    items: [{ title: "Test Product", quantity: 1, weight: 0.5, value: 100 }],
    totalValue: 100,
    reference: "integration-smoke-test",
  });
  console.log(`  Success: ${shipResult.success}`);
  console.log(`  Tracking: ${shipResult.trackingNumber ?? "N/A"}`);
  console.log(`  Label: ${shipResult.labelUrl ?? "N/A"}`);
  console.log(`  Error: ${shipResult.error ?? "none"}`);

  if (!shipResult.success || !shipResult.trackingNumber) {
    console.log("  ✗ Shipment creation failed — skipping track/cancel tests.");
    return;
  }

  const trackingNumber = shipResult.trackingNumber;
  await sleep(2000); // Wait for DHL to register the shipment

  // 4. Track shipment
  subHeader("4. trackShipment");
  const trackResult = await dhlAdapter.trackShipment(creds, trackingNumber);
  console.log(`  Status: ${trackResult.status}`);
  console.log(`  Updates: ${trackResult.updates.length}`);
  trackResult.updates.slice(0, 3).forEach((u) =>
    console.log(`    [${u.status}] ${u.location ?? "N/A"} — ${u.description ?? "N/A"}`)
  );

  // 5. Cancel shipment
  subHeader("5. cancelShipment");
  if (dhlAdapter.cancelShipment) {
    const cancelResult = await dhlAdapter.cancelShipment(creds, trackingNumber);
    console.log(`  Success: ${cancelResult.success}`);
    console.log(`  Message: ${cancelResult.message}`);
  } else {
    console.log("  ⚠ cancelShipment not implemented for DHL");
  }
}

// ═══════════════════════════════════════════════════════════
// DTDC Integration Tests
// ═══════════════════════════════════════════════════════════
async function testDTDC() {
  header("DTDC Integration Test");

  const creds: ShippingProviderCredentials = {
    apiKey: process.env.DTDC_API_KEY ?? "",
    baseUrl: process.env.DTDC_BASE_URL ?? "https://api.dtdc.in",
  };

  if (!creds.apiKey) {
    console.log("  ⚠ DTDC_API_KEY not set — skipping DTDC tests.");
    console.log("  Set env vars: DTDC_API_KEY, DTDC_BASE_URL");
    return;
  }

  console.log(`  Base URL: ${creds.baseUrl}`);
  console.log(`  API Key:  ${creds.apiKey.slice(0, 6)}****`);

  // 1. Connection test
  subHeader("1. testConnection");
  const connResult = await dtdcAdapter.testConnection(creds);
  console.log(`  Success: ${connResult.success}`);
  console.log(`  Message: ${connResult.message}`);
  console.log(`  Latency: ${connResult.latencyMs}ms`);

  if (!connResult.success) {
    console.log("  ✗ Connection failed — skipping remaining DTDC tests.");
    return;
  }

  // 2. Create shipment
  subHeader("2. createShipment");
  const shipResult = await dtdcAdapter.createShipment(creds, {
    orderNumber: `SMOKE-${Date.now()}`,
    recipientName: "Smoke Test Recipient",
    recipientEmail: "smoke-test@example.com",
    address: {
      line1: "456 Test Road",
      city: "Bangalore",
      postalCode: "560001",
    },
    countryCode: "IN",
    items: [{ title: "Test Product", quantity: 1, weight: 0.5, value: 100 }],
    totalValue: 100,
    reference: "integration-smoke-test",
  });
  console.log(`  Success: ${shipResult.success}`);
  console.log(`  AWB: ${shipResult.trackingNumber ?? "N/A"}`);
  console.log(`  Label: ${shipResult.labelUrl ?? "N/A"}`);
  console.log(`  Error: ${shipResult.error ?? "none"}`);

  if (!shipResult.success || !shipResult.trackingNumber) {
    console.log("  ✗ Shipment creation failed — skipping track/cancel tests.");
    return;
  }

  const awb = shipResult.trackingNumber;
  await sleep(2000);

  // 3. Track shipment
  subHeader("3. trackShipment");
  const trackResult = await dtdcAdapter.trackShipment(creds, awb);
  console.log(`  Status: ${trackResult.status}`);
  console.log(`  Updates: ${trackResult.updates.length}`);
  trackResult.updates.slice(0, 3).forEach((u) =>
    console.log(`    [${u.status}] ${u.location ?? "N/A"} — ${u.description ?? "N/A"}`)
  );

  // 4. Cancel shipment
  subHeader("4. cancelShipment");
  if (dtdcAdapter.cancelShipment) {
    const cancelResult = await dtdcAdapter.cancelShipment(creds, awb);
    console.log(`  Success: ${cancelResult.success}`);
    console.log(`  Message: ${cancelResult.message}`);
  } else {
    console.log("  ⚠ cancelShipment not implemented for DTDC");
  }
}

// ═══════════════════════════════════════════════════════════
// Run all tests
// ═══════════════════════════════════════════════════════════
async function main() {
  console.log("🧪 Shipping Adapter Integration Smoke Test");
  console.log("=".repeat(60));
  console.log("This test uses REAL API credentials.");
  console.log("Set env vars before running:\n");
  console.log("  DHL_API_KEY=your_dhl_api_key");
  console.log("  DHL_API_SECRET=your_dhl_api_secret");
  console.log("  DHL_BASE_URL=https://api-test.dhl.com/mydhlapi");
  console.log("  DTDC_API_KEY=your_dtdc_api_key");
  console.log("  DTDC_BASE_URL=https://api.dtdc.in");

  try {
    await testDHL();
    await testDTDC();
  } catch (err) {
    console.error("\n❌ Unexpected error:", err);
  }

  console.log(`\n${"═".repeat(60)}`);
  console.log("  Smoke test complete.");
  console.log(`${"═".repeat(60)}\n`);
}

main();
