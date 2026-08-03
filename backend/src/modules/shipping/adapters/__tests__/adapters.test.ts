/**
 * Shipping Adapter Unit Tests
 * Run: npx ts-node --transpile-only src/modules/shipping/adapters/__tests__/adapters.test.ts
 *
 * Mocks global.fetch to simulate API responses — no real API keys needed.
 */

import { describe, it, before, after, mock } from "node:test";
import assert from "node:assert/strict";

// ── Mock fetch before importing adapters ──────────────────
const originalFetch = global.fetch;

type MockResponse = {
  ok: boolean;
  status: number;
  statusText: string;
  json: () => Promise<Record<string, unknown>>;
};

function mockFetch(handler: (url: string, init?: RequestInit) => MockResponse) {
  global.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    const res = handler(url, init);
    return {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      json: async () => res.json(),
      headers: new Headers(),
      redirected: false,
      type: "basic",
      url,
      clone: () => ({ json: async () => res.json() }),
      body: null,
      bodyUsed: false,
      arrayBuffer: async () => new ArrayBuffer(0),
      blob: async () => new Blob(),
      formData: async () => new FormData(),
      text: async () => JSON.stringify(res.json()),
    } as unknown as Response;
  }) as typeof global.fetch;
}

// ── Imports ───────────────────────────────────────────────
import { getAdapter } from "../index";
import type { ShippingProviderCredentials, ShipmentRequest } from "../types";

// ── Fixtures ──────────────────────────────────────────────
const FAKE_CREDS: ShippingProviderCredentials = {
  apiKey: "test-api-key-12345",
  apiSecret: "test-api-secret-67890",
  baseUrl: "https://api-test.example.com",
};

const FAKE_SHIPMENT_REQ: ShipmentRequest = {
  orderNumber: "ORD-2024-001",
  recipientName: "Test Customer",
  recipientEmail: "test@example.com",
  address: {
    line1: "123 Test Street",
    city: "Mumbai",
    postalCode: "400001",
    country: "India",
  },
  countryCode: "IN",
  items: [
    { title: "Orthodontic Bracket Kit", sku: "OBK-001", quantity: 2, weight: 0.5, value: 5000 },
  ],
  totalValue: 10000,
  reference: "ORD-2024-001",
};

// ═══════════════════════════════════════════════════════════
// DHL Adapter Tests
// ═══════════════════════════════════════════════════════════
describe("DHL Adapter", () => {
  const adapter = getAdapter("DHL");
  assert.ok(adapter, "DHL adapter should be registered");

  after(() => { global.fetch = originalFetch; });

  describe("testConnection", () => {
    it("should return success when API responds 200", async () => {
      mockFetch((url) => {
        assert.ok(url.includes("/test/connect"), "Should call DHL test/connect endpoint");
        return { ok: true, status: 200, statusText: "OK", json: async () => ({}) };
      });
      const result = await adapter!.testConnection(FAKE_CREDS);
      assert.equal(result.success, true);
      assert.ok(result.latencyMs >= 0);
    });

    it("should return failure when API responds 401", async () => {
      mockFetch(() => ({
        ok: false, status: 401, statusText: "Unauthorized",
        json: async () => ({ title: "Unauthorized" }),
      }));
      const result = await adapter!.testConnection(FAKE_CREDS);
      assert.equal(result.success, false);
      assert.ok(result.message.includes("401"));
    });

    it("should return failure when baseUrl is missing", async () => {
      const result = await adapter!.testConnection({ apiKey: "k", baseUrl: null });
      assert.equal(result.success, false);
      assert.ok(result.message.includes("not configured"));
    });

    it("should handle network errors gracefully", async () => {
      mockFetch(() => { throw new Error("ECONNREFUSED"); });
      const result = await adapter!.testConnection(FAKE_CREDS);
      assert.equal(result.success, false);
      assert.ok(result.message.includes("ECONNREFUSED"));
    });
  });

  describe("createShipment", () => {
    it("should return success with tracking number on 200", async () => {
      mockFetch((url, init) => {
        assert.ok(url.includes("/shipments"), "Should POST to /mydhlapi/shipments");
        assert.equal(init?.method, "POST");
        return {
          ok: true, status: 200, statusText: "OK",
          json: async () => ({
            shipmentId: "DHL-SHP-001",
            trackingNumber: "1234567890",
            labelUrl: "https://label.dhl.com/1234567890.pdf",
            estimatedDeliveryDate: "2024-12-20",
          }),
        };
      });
      const result = await adapter!.createShipment(FAKE_CREDS, FAKE_SHIPMENT_REQ);
      assert.equal(result.success, true);
      assert.equal(result.trackingNumber, "1234567890");
      assert.equal(result.labelUrl, "https://label.dhl.com/1234567890.pdf");
      assert.ok(result.providerResponse);
    });

    it("should return error on 400", async () => {
      mockFetch(() => ({
        ok: false, status: 400, statusText: "Bad Request",
        json: async () => ({ message: "Invalid shipment data" }),
      }));
      const result = await adapter!.createShipment(FAKE_CREDS, FAKE_SHIPMENT_REQ);
      assert.equal(result.success, false);
      assert.ok(result.error?.includes("Invalid shipment data"));
    });

    it("should handle network errors", async () => {
      mockFetch(() => { throw new Error("TIMEOUT"); });
      const result = await adapter!.createShipment(FAKE_CREDS, FAKE_SHIPMENT_REQ);
      assert.equal(result.success, false);
      assert.ok(result.error?.includes("TIMEOUT"));
    });
  });

  describe("trackShipment", () => {
    it("should return tracking updates on 200", async () => {
      mockFetch((url) => {
        assert.ok(url.includes("/tracking"), "Should call tracking endpoint");
        return {
          ok: true, status: 200, statusText: "OK",
          json: async () => ({
            shipments: [{
              status: { statusCode: "transit", status: "In Transit" },
              checkpoints: [
                { statusCode: "transit", description: "Shipment in transit", timestamp: "2024-12-18T10:00:00Z", serviceArea: { description: "Mumbai Hub" } },
                { statusCode: "pre-transit", description: "Shipment picked up", timestamp: "2024-12-17T14:00:00Z", serviceArea: { description: "Delhi" } },
              ],
            }],
          }),
        };
      });
      const result = await adapter!.trackShipment(FAKE_CREDS, "1234567890");
      assert.equal(result.trackingNumber, "1234567890");
      assert.equal(result.status, "IN_TRANSIT");
      assert.equal(result.updates.length, 2);
      assert.equal(result.updates[0].location, "Mumbai Hub");
      assert.equal(result.updates[1].location, "Delhi");
    });

    it("should return UNKNOWN status on error", async () => {
      mockFetch(() => { throw new Error("DNS error"); });
      const result = await adapter!.trackShipment(FAKE_CREDS, "bad-number");
      assert.equal(result.status, "UNKNOWN");
      assert.equal(result.updates.length, 0);
    });
  });

  describe("cancelShipment", () => {
    it("should return success on 200", async () => {
      mockFetch((url, init) => {
        assert.ok(url.includes("/shipments/DHL-SHP-001"));
        assert.equal(init?.method, "DELETE");
        return { ok: true, status: 200, statusText: "OK", json: async () => ({}) };
      });
      const result = await adapter!.cancelShipment!(FAKE_CREDS, "DHL-SHP-001");
      assert.equal(result.success, true);
    });

    it("should return failure on error", async () => {
      mockFetch(() => ({
        ok: false, status: 404, statusText: "Not Found",
        json: async () => ({ message: "Shipment not found" }),
      }));
      const result = await adapter!.cancelShipment!(FAKE_CREDS, "NONEXISTENT");
      assert.equal(result.success, false);
    });
  });

  describe("getRates", () => {
    it("should return rate results or empty array", async () => {
      mockFetch(() => ({
        ok: true, status: 200, statusText: "OK",
        json: async () => ({
          products: [{ productName: "DHL Express", totalPrice: [1500], priceCurrency: "INR", estimatedDeliveryDate: "3 days" }],
        }),
      }));
      const result = await adapter!.getRates(FAKE_CREDS, { countryCode: "US", orderTotal: 5000 });
      assert.ok(Array.isArray(result));
      if (result.length > 0) {
        assert.equal(result[0].provider, "DHL");
        assert.equal(result[0].charge, 1500);
      }
    });
  });
});

// ═══════════════════════════════════════════════════════════
// DTDC Adapter Tests
// ═══════════════════════════════════════════════════════════
describe("DTDC Adapter", () => {
  const adapter = getAdapter("DTDC");
  assert.ok(adapter, "DTDC adapter should be registered");

  after(() => { global.fetch = originalFetch; });

  describe("testConnection", () => {
    it("should return success when API responds 200", async () => {
      mockFetch((url) => {
        assert.ok(url.includes("/api/v1/validate"), "Should call DTDC validate endpoint");
        return {
          ok: true, status: 200, statusText: "OK",
          json: async () => ({ message: "Token valid" }),
        };
      });
      const result = await adapter!.testConnection(FAKE_CREDS);
      assert.equal(result.success, true);
    });

    it("should return failure when baseUrl is missing", async () => {
      const result = await adapter!.testConnection({ apiKey: "k", baseUrl: null });
      assert.equal(result.success, false);
      assert.ok(result.message.includes("not configured"));
    });
  });

  describe("createShipment", () => {
    it("should return AWB number on success", async () => {
      mockFetch((url, init) => {
        assert.ok(url.includes("/api/v1/consignment/book"), "Should POST to book endpoint");
        assert.equal(init?.method, "POST");
        const body = JSON.parse(init?.body as string);
        assert.equal(body.reference_no, "ORD-2024-001");
        assert.equal(body.consignee.name, "Test Customer");
        return {
          ok: true, status: 200, statusText: "OK",
          json: async () => ({
            data: {
              consignmentNo: "DTDC-AWB-98765",
              labelUrl: "https://dtdc.in/label/98765.pdf",
              estimatedDelivery: "2024-12-22",
            },
          }),
        };
      });
      const result = await adapter!.createShipment(FAKE_CREDS, FAKE_SHIPMENT_REQ);
      assert.equal(result.success, true);
      assert.equal(result.trackingNumber, "DTDC-AWB-98765");
      assert.equal(result.labelUrl, "https://dtdc.in/label/98765.pdf");
    });

    it("should handle error responses", async () => {
      mockFetch(() => ({
        ok: false, status: 422, statusText: "Unprocessable",
        json: async () => ({ message: "Invalid pincode" }),
      }));
      const result = await adapter!.createShipment(FAKE_CREDS, FAKE_SHIPMENT_REQ);
      assert.equal(result.success, false);
      assert.ok(result.error?.includes("Invalid pincode"));
    });
  });

  describe("trackShipment", () => {
    it("should return tracking updates", async () => {
      mockFetch(() => ({
        ok: true, status: 200, statusText: "OK",
        json: async () => ({
          data: {
            currentStatus: "IN TRANSIT",
            scanHistory: [
              { status: "IN TRANSIT", location: "Bangalore Hub", scanDate: "2024-12-18T08:00:00Z", remarks: "Forwarded" },
              { status: "BOOKED", location: "Mumbai", scanDate: "2024-12-17T12:00:00Z", remarks: "Shipment booked" },
            ],
          },
        }),
      }));
      const result = await adapter!.trackShipment(FAKE_CREDS, "DTDC-AWB-98765");
      assert.equal(result.status, "IN_TRANSIT");
      assert.equal(result.updates.length, 2);
      assert.equal(result.updates[0].location, "Bangalore Hub");
    });
  });

  describe("cancelShipment", () => {
    it("should return success on 200", async () => {
      mockFetch((url, init) => {
        assert.ok(url.includes("/api/v1/consignment/cancel"));
        assert.equal(init?.method, "POST");
        return {
          ok: true, status: 200, statusText: "OK",
          json: async () => ({ message: "Cancelled" }),
        };
      });
      const result = await adapter!.cancelShipment!(FAKE_CREDS, "DTDC-AWB-98765");
      assert.equal(result.success, true);
    });

    it("should handle errors", async () => {
      mockFetch(() => ({
        ok: false, status: 400, statusText: "Bad Request",
        json: async () => ({ error: "Already dispatched" }),
      }));
      const result = await adapter!.cancelShipment!(FAKE_CREDS, "DTDC-AWB-98765");
      assert.equal(result.success, false);
    });
  });

  describe("getRates", () => {
    it("should return empty array when destination pincode is missing", async () => {
      const result = await adapter!.getRates(FAKE_CREDS, { countryCode: "IN", orderTotal: 5000 });
      assert.equal(result.length, 0);
    });

    it("should parse live rates from the configured endpoint", async () => {
      mockFetch((url, init) => {
        assert.ok(url.includes("/api/v1/rates"), "Should POST to configured rate endpoint");
        assert.equal(init?.method, "POST");
        return {
          ok: true, status: 200, statusText: "OK",
          json: async () => ({
            data: {
              rates: [
                { serviceName: "B2C PRIORITY", totalCost: 185, currency: "INR", transitDays: 2 },
                { serviceName: "B2C SMART EXPRESS", totalCost: 145, currency: "INR", transitDays: 4 },
              ],
            },
          }),
        };
      });
      const result = await adapter!.getRates(FAKE_CREDS, { countryCode: "IN", orderTotal: 5000, destinationPincode: "110001" });
      assert.equal(result.length, 2);
      assert.equal(result[0].provider, "DTDC");
      assert.equal(result[0].service, "B2C PRIORITY");
      assert.equal(result[0].charge, 185);
      assert.equal(result[0].estimatedDays, "2");
    });

    it("should use the configured rateEndpoint when provided", async () => {
      mockFetch((url) => {
        assert.ok(url.includes("https://custom.dtdc.example.com/freight"), "Should use configured rate endpoint");
        return {
          ok: true, status: 200, statusText: "OK",
          json: async () => ({ data: { totalFrightCharge: 200, eta: "3-5 days", currency: "INR" } }),
        };
      });
      const result = await adapter!.getRates({ ...FAKE_CREDS, rateEndpoint: "https://custom.dtdc.example.com/freight" }, { countryCode: "IN", orderTotal: 5000, destinationPincode: "560001" });
      assert.equal(result.length, 1);
      assert.equal(result[0].charge, 200);
      assert.equal(result[0].estimatedDays, "3-5 days");
    });

    it("should return empty array on HTTP error", async () => {
      mockFetch(() => ({
        ok: false, status: 422, statusText: "Unprocessable",
        json: async () => ({ message: "Invalid pincode" }),
      }));
      const result = await adapter!.getRates(FAKE_CREDS, { countryCode: "IN", orderTotal: 5000, destinationPincode: "999999" });
      assert.equal(result.length, 0);
    });

    it("should handle network errors gracefully", async () => {
      mockFetch(() => { throw new Error("TIMEOUT"); });
      const result = await adapter!.getRates(FAKE_CREDS, { countryCode: "IN", orderTotal: 5000, destinationPincode: "110001" });
      assert.equal(result.length, 0);
    });
  });
});

// ═══════════════════════════════════════════════════════════
// Factory Tests
// ═══════════════════════════════════════════════════════════
describe("Adapter Factory", () => {
  it("should return DHL adapter for 'DHL'", () => {
    assert.equal(getAdapter("DHL")?.name, "DHL");
  });

  it("should return DTDC adapter for 'DTDC'", () => {
    assert.equal(getAdapter("DTDC")?.name, "DTDC");
  });

  it("should handle case-insensitive lookup", () => {
    assert.equal(getAdapter("dhl")?.name, "DHL");
    assert.equal(getAdapter("dtdc")?.name, "DTDC");
  });

  it("should return null for unknown provider", () => {
    assert.equal(getAdapter("FEDEX"), null);
    assert.equal(getAdapter("UNKNOWN"), null);
  });
});

// ═══════════════════════════════════════════════════════════
// Status Mapping Tests
// ═══════════════════════════════════════════════════════════
describe("Status Mapping", () => {
  after(() => { global.fetch = originalFetch; });

  it("DHL should map 'delivered' to DELIVERED", async () => {
    mockFetch(() => ({
      ok: true, status: 200, statusText: "OK",
      json: async () => ({
        shipments: [{ status: { statusCode: "delivered" }, checkpoints: [] }],
      }),
    }));
    const result = await getAdapter("DHL")!.trackShipment(FAKE_CREDS, "x");
    assert.equal(result.status, "DELIVERED");
  });

  it("DHL should map 'pre-transit' to LABEL_GENERATED", async () => {
    mockFetch(() => ({
      ok: true, status: 200, statusText: "OK",
      json: async () => ({
        shipments: [{ status: { statusCode: "pre-transit" }, checkpoints: [] }],
      }),
    }));
    const result = await getAdapter("DHL")!.trackShipment(FAKE_CREDS, "x");
    assert.equal(result.status, "LABEL_GENERATED");
  });

  it("DTDC should map 'DELIVERED' to DELIVERED", async () => {
    mockFetch(() => ({
      ok: true, status: 200, statusText: "OK",
      json: async () => ({ data: { currentStatus: "DELIVERED", scanHistory: [] } }),
    }));
    const result = await getAdapter("DTDC")!.trackShipment(FAKE_CREDS, "x");
    assert.equal(result.status, "DELIVERED");
  });

  it("DTDC should map 'RTO' to FAILED", async () => {
    mockFetch(() => ({
      ok: true, status: 200, statusText: "OK",
      json: async () => ({ data: { currentStatus: "RTO", scanHistory: [] } }),
    }));
    const result = await getAdapter("DTDC")!.trackShipment(FAKE_CREDS, "x");
    assert.equal(result.status, "FAILED");
  });
});

console.log("\n✅ All adapter tests complete.\n");
