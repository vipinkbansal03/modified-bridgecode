import { logger } from "../../config/logger";

const GST_VALIDATION_URL = process.env.GST_VALIDATION_URL?.trim();
const GST_VALIDATION_API_KEY = process.env.GST_VALIDATION_API_KEY?.trim();
const GST_VALIDATION_TIMEOUT_MS = Number(process.env.GST_VALIDATION_TIMEOUT_MS || 7000);

export type GstValidationPayload = {
  valid: boolean;
  gstin: string;
  companyName?: string | null;
  address?: string | null;
  message: string;
  source: "GST_API" | "GSTIN_FORMAT";
};

export async function validateGstinWithApi(gstin: string): Promise<GstValidationPayload> {
  const normalizedGstin = gstin.trim().toUpperCase();
  if (!GST_VALIDATION_URL) {
    return {
      valid: true,
      gstin: normalizedGstin,
      companyName: null,
      address: null,
      message: "GSTIN format validated. Official GST validation API is not configured.",
      source: "GSTIN_FORMAT",
    };
  }

  try {
    const url = new URL(GST_VALIDATION_URL);
    url.searchParams.set("gstin", normalizedGstin);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GST_VALIDATION_TIMEOUT_MS);
    const response = await fetch(url.toString(), {
      method: "GET",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(GST_VALIDATION_API_KEY ? { Authorization: `Bearer ${GST_VALIDATION_API_KEY}` } : {}),
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      logger.error(`[GST] validation API responded with ${response.status} ${response.statusText}`);
      return {
        valid: true,
        gstin: normalizedGstin,
        companyName: null,
        address: null,
        message: "GST validation service is unavailable. Format validation was performed.",
        source: "GSTIN_FORMAT",
      };
    }

    const payload = (await response.json()) as any;
    const valid = Boolean(payload?.valid);
    const companyName = payload?.companyName || payload?.name || null;
    const address = payload?.address || payload?.location || null;
    const message = valid
      ? "GSTIN verified successfully."
      : payload?.message || payload?.error || "Invalid GSTIN.";

    return {
      valid,
      gstin: normalizedGstin,
      companyName,
      address,
      message,
      source: "GST_API",
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown error";
    logger.error(`[GST] validation failed for ${normalizedGstin}: ${reason}`);
    return {
      valid: true,
      gstin: normalizedGstin,
      companyName: null,
      address: null,
      message: "GST validation service is unavailable. Format validation was performed.",
      source: "GSTIN_FORMAT",
    };
  }
}
