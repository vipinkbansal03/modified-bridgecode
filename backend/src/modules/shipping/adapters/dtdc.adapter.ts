import { logger } from "../../../config/logger";
import type { ShippingProviderAdapter, ShippingProviderCredentials, ConnectionTestResult, RateRequest, RateResult, ShipmentRequest, ShipmentResult, TrackingResult } from "./types";

const TIMEOUT_MS = 15000;

export const dtdcAdapter: ShippingProviderAdapter = {
  name: "DTDC",

  async testConnection(c: ShippingProviderCredentials): Promise<ConnectionTestResult> {
    if (!c.baseUrl) return { success: false, message: "DTDC base URL is not configured.", latencyMs: 0 };
    const start = Date.now();
    try {
      const res = await fetch(c.baseUrl + "/api/v1/validate", {
        method: "POST",
        headers: { Authorization: `Bearer ${c.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ token: c.apiKey }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const latencyMs = Date.now() - start;
      if (res.ok) return { success: true, message: "DTDC connection successful.", latencyMs };
      return { success: false, message: `DTDC returned HTTP ${res.status}.`, latencyMs };
    } catch (error) {
      const latencyMs = Date.now() - start;
      const msg = error instanceof Error ? error.message : "Unknown error";
      logger.warn(`DTDC connection test failed: ${msg}`);
      return { success: false, message: `Connection failed: ${msg}`, latencyMs };
    }
  },

  async getRates(_c: ShippingProviderCredentials, _request: RateRequest): Promise<RateResult[]> {
    // TODO: Implement DTDC rate API
    logger.info("DTDC rate API not yet implemented — using zone-based rates");
    return [];
  },

  async createShipment(_c: ShippingProviderCredentials, _request: ShipmentRequest): Promise<ShipmentResult> {
    // TODO: Implement DTDC shipment booking
    logger.info("DTDC shipment API not yet implemented");
    return { success: false, error: "DTDC shipment API not yet implemented." };
  },

  async trackShipment(_c: ShippingProviderCredentials, trackingNumber: string): Promise<TrackingResult> {
    // TODO: Implement DTDC tracking
    logger.info("DTDC tracking API not yet implemented");
    return { trackingNumber, status: "UNKNOWN", updates: [] };
  },
};
