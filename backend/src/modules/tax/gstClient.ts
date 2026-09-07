import { logger } from "../../config/logger";
import { getSettingValue } from "../settings/settings.service";

const GST_VALIDATION_TIMEOUT_MS = Number(process.env.GST_VALIDATION_TIMEOUT_MS || 7000);

export type GstValidationPayload = {
  valid: boolean;
  gstin: string;
  companyName?: string | null;
  address?: string | null;
  message: string;
  source: "GST_API" | "GSTIN_FORMAT";
};

let cachedToken: string | null = null;
let tokenExpiryTime = 0;

async function getSandboxToken(apiKey: string, apiSecret: string): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiryTime) {
    return cachedToken;
  }

  const response = await fetch("https://api.sandbox.co.in/authenticate", {
    method: "POST",
    headers: {
      "accept": "application/json",
      "x-api-key": apiKey,
      "x-api-secret": apiSecret,
      "x-api-version": "1.0.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Sandbox auth failed with status ${response.status}`);
  }

  const data = (await response.json()) as any;
  const token = data?.access_token;
  if (!token) {
    throw new Error("Sandbox auth response did not return access_token");
  }

  cachedToken = token;
  // Cache for 23 hours (valid for 24h)
  tokenExpiryTime = Date.now() + 23 * 60 * 60 * 1000;
  return token;
}

export async function validateGstinWithApi(gstin: string): Promise<GstValidationPayload> {
  const normalizedGstin = gstin.trim().toUpperCase();
  const apiKey = (await getSettingValue("tax.sandbox_api_key")) || process.env.SANDBOX_API_KEY?.trim() || "";
  const apiSecret = (await getSettingValue("tax.sandbox_api_secret")) || process.env.SANDBOX_API_SECRET?.trim() || "";

  if (apiKey && apiSecret) {
    try {
      const token = await getSandboxToken(apiKey, apiSecret);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), GST_VALIDATION_TIMEOUT_MS);

      const response = await fetch("https://api.sandbox.co.in/gst/compliance/public/gstin/verify", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "accept": "application/json",
          "authorization": token,
          "x-api-key": apiKey,
          "x-api-version": "1.0.0",
        },
        body: JSON.stringify({ gstin: normalizedGstin }),
      });
      clearTimeout(timeout);

      if (!response.ok) {
        logger.error(`[GST] Sandbox API verification returned status ${response.status}`);
        return {
          valid: true,
          gstin: normalizedGstin,
          companyName: null,
          address: null,
          message: "GST validation service is temporarily unavailable. Format validation was performed.",
          source: "GSTIN_FORMAT",
        };
      }

      const resJson = (await response.json()) as any;
      const data = resJson?.data?.data;
      if (resJson?.code === 200 && data) {
        const isActive = data.status?.toLowerCase() === "active";
        return {
          valid: isActive,
          gstin: normalizedGstin,
          companyName: data.legalName || null,
          address: data.stateName || null,
          message: isActive ? "GSTIN verified successfully." : "GSTIN is inactive or suspended.",
          source: "GST_API",
        };
      } else {
        return {
          valid: false,
          gstin: normalizedGstin,
          companyName: null,
          address: null,
          message: resJson?.message || "Invalid GSTIN details returned by provider.",
          source: "GST_API",
        };
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown error";
      logger.error(`[GST] Sandbox validation failed for ${normalizedGstin}: ${reason}`);
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

  const GST_VALIDATION_URL = process.env.GST_VALIDATION_URL?.trim();
  const GST_VALIDATION_API_KEY = process.env.GST_VALIDATION_API_KEY?.trim();
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
