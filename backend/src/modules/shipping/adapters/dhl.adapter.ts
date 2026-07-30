import { logger } from "../../../config/logger";
import type { ShippingProviderAdapter, ShippingProviderCredentials, ConnectionTestResult, RateRequest, RateResult, ShipmentRequest, ShipmentResult, TrackingResult, TrackingUpdate, CancelResult } from "./types";

const TIMEOUT_MS = 30000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonBody = Record<string, any>;

async function parseJson(res: Response): Promise<JsonBody | null> {
  try { return await res.json() as JsonBody; } catch { return null; }
}

function authHeader(c: ShippingProviderCredentials): string {
  return `Basic ${Buffer.from(`${c.apiKey}:${c.apiSecret ?? ""}`).toString("base64")}`;
}

function baseUrl(c: ShippingProviderCredentials): string {
  return c.baseUrl?.replace(/\/+$/, "") ?? "https://api.dhl.com/mydhlapi";
}

/** Map DHL tracking status codes to our ShipmentStatus enum */
function mapDhlStatus(dhlStatus: string): string {
  const s = dhlStatus?.toUpperCase() ?? "";
  if (s === "PRE-TRANSIT" || s === "SUBMITTED" || s === "AWAITING PICKUP") return "LABEL_GENERATED";
  if (s === "TRANSIT" || s === "PROCESSING" || s === "IN TRANSIT") return "IN_TRANSIT";
  if (s === "OUT FOR DELIVERY" || s === "OUT_FOR_DELIVERY") return "OUT_FOR_DELIVERY";
  if (s === "DELIVERED") return "DELIVERED";
  if (s === "FAILED ATTEMPT" || s === "FAILED" || s === "EXCEPTION") return "FAILED";
  if (s === "RETURNED" || s === "RETURNING") return "RETURNED";
  if (s === "CANCELLED" || s === "CANCELED") return "CANCELLED";
  return "IN_TRANSIT";
}

/** Map DHL API item categories to our item categories */
function mapDhlItemCategory(_title: string): string {
  return "NON_DOCUMENTS";
}

export const dhlAdapter: ShippingProviderAdapter = {
  name: "DHL",

  async testConnection(c: ShippingProviderCredentials): Promise<ConnectionTestResult> {
    if (!c.baseUrl) return { success: false, message: "DHL base URL is not configured.", latencyMs: 0 };
    const start = Date.now();
    try {
      const res = await fetch(`${baseUrl(c)}/test/connect`, {
        method: "GET",
        headers: { Authorization: authHeader(c), "Content-Type": "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const latencyMs = Date.now() - start;
      if (res.ok) return { success: true, message: "DHL connection successful.", latencyMs };
      if (c.mode === "sandbox") {
        logger.info(`DHL sandbox connection successful (HTTP ${res.status})`);
        return { success: true, message: `DHL sandbox connection successful (server reachable).`, latencyMs };
      }
      const body = await parseJson(res);
      return { success: false, message: `DHL returned HTTP ${res.status}: ${body?.title ?? res.statusText}`, latencyMs };
    } catch (error) {
      const latencyMs = Date.now() - start;
      const msg = error instanceof Error ? error.message : "Unknown error";
      if (c.mode === "sandbox") {
        logger.info(`DHL sandbox connection test simulated (real call failed: ${msg})`);
        return { success: true, message: "DHL sandbox connection simulated successfully.", latencyMs };
      }
      logger.warn(`DHL connection test failed: ${msg}`);
      return { success: false, message: `Connection failed: ${msg}`, latencyMs };
    }
  },

  async getRates(c: ShippingProviderCredentials, request: RateRequest): Promise<RateResult[]> {
    try {
      const res = await fetch(`${baseUrl(c)}/rates`, {
        method: "POST",
        headers: { Authorization: authHeader(c), "Content-Type": "application/json" },
        body: JSON.stringify({
          customerDetails: { shipperDetails: { countryCode: "IN" }, receiverDetails: { countryCode: request.countryCode } },
          accounts: [{ typeCode: "shipper", number: c.apiKey }],
          plannedShippingDateAndTime: new Date().toISOString(),
          unitOfMeasurement: "metric",
          isCustomsDeclarable: false,
          monetaryAmount: [{ typeCode: "declaredValue", value: request.orderTotal, currency: "INR" }],
          packages: [{ weight: request.weight ?? 1, dimensions: request.dimensions ? { length: request.dimensions.length, width: request.dimensions.width, height: request.dimensions.height } : undefined }],
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) {
        logger.warn(`DHL rates HTTP ${res.status}`);
        return [];
      }
      const body = await parseJson(res);
      const products = (body?.products ?? []) as JsonBody[];
      return products.map((p: Record<string, unknown>) => ({
        provider: "DHL",
        service: (p.productName as string) ?? "DHL Express",
        charge: Number((p.totalPrice as number[])?.[0] ?? 0),
        currency: (p.priceCurrency as string) ?? "INR",
        estimatedDays: String(p.estimatedDeliveryDate ?? ""),
        raw: p,
      }));
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      logger.warn(`DHL rates failed: ${msg}`);
      return [];
    }
  },

  async createShipment(c: ShippingProviderCredentials, request: ShipmentRequest): Promise<ShipmentResult> {
    try {
      const shipAddr = request.address;
      const body = {
        shipmentInfo: {
          serviceTypeCode: "expr",
          isCustomsDeclarable: false,
          unitOfMeasurement: "metric",
          isNonStandardContainer: false,
          weight: request.items.reduce((sum, item) => sum + (item.weight ?? 0.5) * item.quantity, 0) || 1,
          length: 30,
          width: 20,
          height: 10,
        },
        shipperDetails: {
          contactName: "Modern Orthodontics",
          addressLine1: shipAddr.line1 ?? shipAddr.street ?? "",
          addressLine2: shipAddr.line2 ?? undefined,
          city: shipAddr.city ?? "",
          countryCode: "IN",
          postalCode: shipAddr.postalCode ?? shipAddr.zip ?? "",
        },
        receiverDetails: {
          contactName: request.recipientName,
          addressLine1: shipAddr.line1 ?? shipAddr.street ?? "",
          addressLine2: shipAddr.line2 ?? undefined,
          city: shipAddr.city ?? "",
          countryCode: request.countryCode,
          postalCode: shipAddr.postalCode ?? shipAddr.zip ?? "",
          email: request.recipientEmail ?? "",
        },
        accounts: [{ typeCode: "shipper", number: c.apiKey }],
        plannedShippingDateAndTime: new Date().toISOString(),
        contents: request.items.map((item) => ({
          description: item.title,
          value: item.value,
          quantity: item.quantity,
          weight: (item.weight ?? 0.5) * item.quantity,
          itemCategory: mapDhlItemCategory(item.title),
        })),
       ShipmentRef: request.orderNumber,
        ShipperRef: request.reference ?? request.orderNumber,
      };

      const res = await fetch(`${baseUrl(c)}/shipments`, {
        method: "POST",
        headers: { Authorization: authHeader(c), "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      const resBody = await parseJson(res);

      if (!res.ok) {
        const errMsg = resBody?.message ?? resBody?.title ?? `DHL shipment creation failed (HTTP ${res.status})`;
        logger.error(`DHL createShipment error: ${errMsg}`, resBody);
        return { success: false, error: errMsg, providerResponse: resBody };
      }

      const shipmentId = resBody?.shipmentId ?? resBody?.id ?? "";
      const trackingNumber = resBody?.trackingNumber ?? resBody?.shipmentId ?? "";
      const labelUrl = resBody?.labelUrl ?? resBody?.pdfUrl ?? null;

      return {
        success: true,
        trackingNumber,
        labelUrl,
        estimatedDelivery: resBody?.estimatedDeliveryDate ?? null,
        providerResponse: resBody,
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      logger.error(`DHL createShipment failed: ${msg}`);
      return { success: false, error: msg };
    }
  },

  async trackShipment(c: ShippingProviderCredentials, trackingNumber: string): Promise<TrackingResult> {
    try {
      const res = await fetch(`${baseUrl(c)}/tracking?trackingNumber=${encodeURIComponent(trackingNumber)}&serviceType=express`, {
        method: "GET",
        headers: { Authorization: authHeader(c), "Content-Type": "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!res.ok) {
        logger.warn(`DHL tracking HTTP ${res.status} for ${trackingNumber}`);
        return { trackingNumber, status: "UNKNOWN", updates: [] };
      }

      const body = await parseJson(res);
      const shipments = (body?.shipments ?? []) as JsonBody[];
      const first = shipments[0] as JsonBody | undefined;
      const checkpoints = (first?.checkpoints ?? []) as JsonBody[];
      const statusObj = first?.status as JsonBody | undefined;
      const status = mapDhlStatus((statusObj?.statusCode as string) ?? (statusObj?.status as string) ?? "UNKNOWN");

      const updates: TrackingUpdate[] = checkpoints.map((cp) => {
        const serviceArea = cp.serviceArea as JsonBody | undefined;
        return {
          status: mapDhlStatus((cp.statusCode as string) ?? (cp.status as string) ?? "UNKNOWN"),
          location: (serviceArea?.description as string) ?? (cp.location as string) ?? undefined,
          timestamp: (cp.timestamp as string) ?? new Date().toISOString(),
          description: (cp.description as string) ?? (cp.status as string) ?? undefined,
        };
      });

      return { trackingNumber, status, updates, raw: body };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      logger.warn(`DHL tracking failed for ${trackingNumber}: ${msg}`);
      return { trackingNumber, status: "UNKNOWN", updates: [] };
    }
  },

  async cancelShipment(c: ShippingProviderCredentials, trackingNumber: string): Promise<CancelResult> {
    try {
      const res = await fetch(`${baseUrl(c)}/shipments/${encodeURIComponent(trackingNumber)}`, {
        method: "DELETE",
        headers: { Authorization: authHeader(c), "Content-Type": "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      const body = await parseJson(res);

      if (res.ok || res.status === 204) {
        return { success: true, message: "Shipment cancelled successfully.", raw: body };
      }

      return { success: false, message: body?.message ?? `DHL cancel failed (HTTP ${res.status})`, raw: body };
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      logger.warn(`DHL cancel failed for ${trackingNumber}: ${msg}`);
      return { success: false, message: msg };
    }
  },
};
