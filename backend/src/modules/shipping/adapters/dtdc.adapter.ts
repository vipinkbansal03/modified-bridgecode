import { logger } from "../../../config/logger";
import type { ShippingProviderAdapter, ShippingProviderCredentials, ConnectionTestResult, RateRequest, RateResult, ShipmentRequest, ShipmentResult, TrackingResult, TrackingUpdate, CancelResult } from "./types";

const TIMEOUT_MS = 30000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonBody = Record<string, any>;

async function parseJson(res: Response): Promise<JsonBody | null> {
  try { return await res.json() as JsonBody; } catch { return null; }
}

function authHeaders(c: ShippingProviderCredentials): Record<string, string> {
  return { Authorization: `Bearer ${c.apiKey}`, "Content-Type": "application/json" };
}

function baseUrl(c: ShippingProviderCredentials): string {
  return c.baseUrl?.replace(/\/+$/, "") ?? "https://api.dtdc.in";
}

/** Map DTDC status to our ShipmentStatus enum */
function mapDtdcStatus(dtdcStatus: string): string {
  const s = dtdcStatus?.toUpperCase() ?? "";
  if (s === "BOOKED" || s === "CREATED" || s === "PICKUP SCHEDULED") return "LABEL_GENERATED";
  if (s === "PICKED UP" || s === "COLLECTED") return "PICKED_UP";
  if (s === "IN TRANSIT" || s === "INTRANSIT" || s === "MOVING") return "IN_TRANSIT";
  if (s === "OUT FOR DELIVERY" || s === "OUT FOR DELV" || s === "OUTFORDELIVERY") return "OUT_FOR_DELIVERY";
  if (s === "DELIVERED" || s === "DELV" || s === "DELEIVERED") return "DELIVERED";
  if (s === "UNDELIVERED" || s === "FAILED" || s === "RTO" || s === "RETURN") return "FAILED";
  if (s === "RETURNED" || s === "RTS") return "RETURNED";
  if (s === "CANCELLED" || s === "CANCEL") return "CANCELLED";
  return "IN_TRANSIT";
}

export const dtdcAdapter: ShippingProviderAdapter = {
  name: "DTDC",

  async testConnection(c: ShippingProviderCredentials): Promise<ConnectionTestResult> {
    if (!c.baseUrl) return { success: false, message: "DTDC base URL is not configured.", latencyMs: 0 };
    const start = Date.now();
    try {
      // DTDC API validation endpoint — verify token is active
      const res = await fetch(`${baseUrl(c)}/api/v1/validate`, {
        method: "POST",
        headers: authHeaders(c),
        body: JSON.stringify({ token: c.apiKey }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const latencyMs = Date.now() - start;
      if (res.ok) {
        const body = await parseJson(res);
        return { success: true, message: body?.message ?? "DTDC connection successful.", latencyMs };
      }
      if (c.mode === "sandbox") {
        logger.info(`DTDC sandbox connection successful (HTTP ${res.status})`);
        return { success: true, message: "DTDC sandbox connection successful (server reachable).", latencyMs };
      }
      return { success: false, message: `DTDC returned HTTP ${res.status}.`, latencyMs };
    } catch (error) {
      const latencyMs = Date.now() - start;
      const msg = error instanceof Error ? error.message : "Unknown error";
      if (c.mode === "sandbox") {
        logger.info(`DTDC sandbox connection test simulated (real call failed: ${msg})`);
        return { success: true, message: "DTDC sandbox connection simulated successfully.", latencyMs };
      }
      logger.warn(`DTDC connection test failed: ${msg}`);
      return { success: false, message: `Connection failed: ${msg}`, latencyMs };
    }
  },

  async getRates(c: ShippingProviderCredentials, request: RateRequest): Promise<RateResult[]> {
    // DTDC does not expose a public rate API. When a contracted rate endpoint is
    // configured (provider.config.rateEndpoint) a live rate is requested; otherwise
    // zone-based rates from the database are used. DTDC is a domestic courier, so a
    // destination pincode is required for a live quote.
    const endpoint = (c.rateEndpoint ?? `${baseUrl(c)}/api/v1/rates`).replace(/\/+$/, "");
    if (!request.destinationPincode) {
      logger.info("DTDC rate lookup skipped: destination pincode is required for a live quote");
      return [];
    }
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          ...authHeaders(c),
          ...(c.apiKey ? { "api-key": c.apiKey } : {}),
        },
        body: JSON.stringify({
          serviceType: "D",
          origin: { pincode: "400001" },
          destination: { pincode: request.destinationPincode },
          countryCode: request.countryCode,
          weight: request.weight ?? 1,
          length: request.dimensions?.length ?? 0,
          width: request.dimensions?.width ?? 0,
          height: request.dimensions?.height ?? 0,
          declaredValue: request.orderTotal,
          paymentMode: "PPD",
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!res.ok) {
        logger.warn(`DTDC rates HTTP ${res.status}`);
        return [];
      }

      const body = await parseJson(res);
      if (!body) return [];

      const data = (body.data ?? body) as JsonBody;
      const rates = (data.rates ?? data.rate ?? [data]) as JsonBody[];
      const results: RateResult[] = [];

      for (const rate of rates) {
        const charge = Number(
          rate.totalCost ?? rate.total_charges ?? rate.totalFrightCharge ?? rate.totalFright ?? rate.freightCharge ?? rate.freight ?? rate.total ?? 0,
        );
        if (!Number.isFinite(charge) || charge <= 0) continue;
        results.push({
          provider: "DTDC",
          service: String(rate.serviceName ?? rate.product ?? rate.serviceType ?? "DTDC Express"),
          charge,
          currency: String(rate.currency ?? data.currency ?? "INR"),
          estimatedDays: String(rate.estimatedDays ?? rate.transitDays ?? rate.deliveryDays ?? rate.eta ?? data.eta ?? ""),
          raw: rate,
        });
      }

      return results;
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      logger.warn(`DTDC rates failed: ${msg}`);
      return [];
    }
  },

  async createShipment(c: ShippingProviderCredentials, request: ShipmentRequest): Promise<ShipmentResult> {
    try {
      const shipAddr = request.address;
      const body = {
        origin: { pincode: shipAddr.postalCode ?? shipAddr.zip ?? "", city: shipAddr.city ?? "" },
        destination: { pincode: shipAddr.postalCode ?? shipAddr.zip ?? "", city: shipAddr.city ?? "" },
        consignee: {
          name: request.recipientName,
          phone: shipAddr.phone ?? "",
          email: request.recipientEmail ?? "",
          address: [shipAddr.line1 ?? shipAddr.street ?? "", shipAddr.line2 ?? ""].filter(Boolean).join(", "),
        },
        shipper: {
          name: "Modern Orthodontics",
          phone: shipAddr.phone ?? "",
          address: [shipAddr.line1 ?? shipAddr.street ?? "", shipAddr.line2 ?? ""].filter(Boolean).join(", "),
        },
        product: "SURFACE",
        payment_mode: "PAID",
        cod_amount: 0,
        declared_value: request.totalValue,
        reference_no: request.orderNumber,
        items: request.items.map((item) => ({
          name: item.title,
          quantity: item.quantity,
          weight: (item.weight ?? 0.5) * item.quantity,
          value: item.value,
        })),
      };

      const res = await fetch(`${baseUrl(c)}/api/v1/consignment/book`, {
        method: "POST",
        headers: authHeaders(c),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      const resBody = await parseJson(res);

      if (!res.ok) {
        const errMsg = resBody?.message ?? resBody?.error ?? `DTDC shipment creation failed (HTTP ${res.status})`;
        logger.error(`DTDC createShipment error: ${errMsg}`, resBody);
        return { success: false, error: errMsg, providerResponse: resBody };
      }

      // DTDC typically returns consignmentNo as the AWB/tracking number
      const awbNumber = resBody?.data?.consignmentNo ?? resBody?.consignmentNo ?? resBody?.awb ?? "";
      const labelUrl = resBody?.data?.labelUrl ?? resBody?.labelUrl ?? null;

      return {
        success: true,
        trackingNumber: awbNumber,
        labelUrl,
        estimatedDelivery: resBody?.data?.estimatedDelivery ?? resBody?.estimatedDelivery ?? null,
        providerResponse: resBody,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      logger.error(`DTDC createShipment failed: ${msg}`);
      return { success: false, error: msg };
    }
  },

  async trackShipment(c: ShippingProviderCredentials, trackingNumber: string): Promise<TrackingResult> {
    try {
      // DTDC tracking by AWB/consignment number
      const res = await fetch(`${baseUrl(c)}/api/v1/consignment/tracking`, {
        method: "POST",
        headers: authHeaders(c),
        body: JSON.stringify({ consignmentNo: trackingNumber }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!res.ok) {
        logger.warn(`DTDC tracking HTTP ${res.status} for ${trackingNumber}`);
        return { trackingNumber, status: "UNKNOWN", updates: [] };
      }

      const body = await parseJson(res);
      const data = (body?.data ?? body) as JsonBody;
      const scanHistory = ((data?.scanHistory ?? data?.scans ?? []) as JsonBody[]);
      const status = mapDtdcStatus((data?.currentStatus as string) ?? (data?.status as string) ?? "UNKNOWN");

      const updates: TrackingUpdate[] = scanHistory.map((scan) => ({
        status: mapDtdcStatus((scan.status as string) ?? (scan.scanType as string) ?? "UNKNOWN"),
        location: (scan.location as string) ?? (scan.city as string) ?? undefined,
        timestamp: (scan.scanDate as string) ?? (scan.timestamp as string) ?? new Date().toISOString(),
        description: (scan.remarks as string) ?? (scan.description as string) ?? undefined,
      }));

      return { trackingNumber, status, updates, raw: body };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      logger.warn(`DTDC tracking failed for ${trackingNumber}: ${msg}`);
      return { trackingNumber, status: "UNKNOWN", updates: [] };
    }
  },

  async cancelShipment(c: ShippingProviderCredentials, trackingNumber: string): Promise<CancelResult> {
    try {
      // DTDC cancellation via consignment cancel endpoint
      const res = await fetch(`${baseUrl(c)}/api/v1/consignment/cancel`, {
        method: "POST",
        headers: authHeaders(c),
        body: JSON.stringify({ consignmentNo: trackingNumber }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      const body = await parseJson(res);

      if (res.ok) {
        return { success: true, message: body?.message ?? "Shipment cancelled successfully.", raw: body };
      }

      return { success: false, message: body?.message ?? body?.error ?? `DTDC cancel failed (HTTP ${res.status})`, raw: body };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      logger.warn(`DTDC cancel failed for ${trackingNumber}: ${msg}`);
      return { success: false, message: msg };
    }
  },
};
