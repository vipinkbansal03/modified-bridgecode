import { logger } from "../../../config/logger";
import type { ShippingProviderAdapter, ShippingProviderCredentials, ConnectionTestResult, RateRequest, RateResult, ShipmentRequest, ShipmentResult, TrackingResult } from "./types";

const TIMEOUT_MS = 15000;

function authHeader(c: ShippingProviderCredentials): string {
  return `Basic ${Buffer.from(`${c.apiKey}:${c.apiSecret ?? ""}`).toString("base64")}`;
}

export const dhlAdapter: ShippingProviderAdapter = {
  name: "DHL",

  async testConnection(c: ShippingProviderCredentials): Promise<ConnectionTestResult> {
    if (!c.baseUrl) return { success: false, message: "DHL base URL is not configured.", latencyMs: 0 };
    const start = Date.now();
    try {
      const res = await fetch(c.baseUrl + "/mydhlapi/test/connect", {
        method: "GET",
        headers: { Authorization: authHeader(c), "Content-Type": "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const latencyMs = Date.now() - start;
      if (res.ok) return { success: true, message: "DHL connection successful.", latencyMs };
      return { success: false, message: `DHL returned HTTP ${res.status}.`, latencyMs };
    } catch (error) {
      const latencyMs = Date.now() - start;
      const msg = error instanceof Error ? error.message : "Unknown error";
      logger.warn(`DHL connection test failed: ${msg}`);
      return { success: false, message: `Connection failed: ${msg}`, latencyMs };
    }
  },

  async getRates(_c: ShippingProviderCredentials, _request: RateRequest): Promise<RateResult[]> {
    // TODO: Implement DHL rate API
    // POST /mydhlapi/rates with shipper/recipient/details
    logger.info("DHL rate API not yet implemented — using zone-based rates");
    return [];
  },

  async createShipment(_c: ShippingProviderCredentials, _request: ShipmentRequest): Promise<ShipmentResult> {
    // TODO: Implement DHL shipment creation
    // POST /mydhlapi/shipments with customs info, label generation
    logger.info("DHL shipment API not yet implemented");
    return { success: false, error: "DHL shipment API not yet implemented." };
  },

  async trackShipment(_c: ShippingProviderCredentials, trackingNumber: string): Promise<TrackingResult> {
    // TODO: Implement DHL tracking
    // GET /mydhlapi/tracking?trackingNumber=
    logger.info("DHL tracking API not yet implemented");
    return { trackingNumber, status: "UNKNOWN", updates: [] };
  },
};
