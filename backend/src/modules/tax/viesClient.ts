import { logger } from "../../config/logger";

const VIES_BASE_URL = "https://ec.europa.eu/taxation_customs/vies/rest-api";
const VIES_TIMEOUT_MS = Number(process.env.VIES_TIMEOUT_MS || 7000);

type ViesResponse = {
  isValid?: boolean;
  userError?: string;
  name?: string;
  address?: string;
  vatNumber?: string;
  originalVatNumber?: string;
  requestDate?: string;
};

function normalizeVatNumber(value: string) {
  return value.replace(/[^A-Z0-9]/g, "").toUpperCase();
}

function extractCountryCode(vatId: string, countryCode?: string) {
  const normalizedVat = normalizeVatNumber(vatId);
  const fallback = (countryCode || "").trim().toUpperCase();
  if (fallback && /^[A-Z]{2}$/.test(fallback)) {
    return fallback;
  }
  if (normalizedVat.length >= 2) {
    return normalizedVat.slice(0, 2);
  }
  return "";
}

export async function validateVatWithVies(vatId: string, countryCode?: string): Promise<{
  valid: boolean;
  countryCode: string;
  vatNumber: string;
  companyName?: string;
  address?: string;
  message: string;
  source: "VIES";
}> {
  const normalizedVat = normalizeVatNumber(vatId);
  const resolvedCountry = extractCountryCode(normalizedVat, countryCode);

  if (!resolvedCountry || !/^[A-Z]{2}$/.test(resolvedCountry)) {
    return {
      valid: false,
      countryCode: resolvedCountry,
      vatNumber: normalizedVat,
      message: "Unsupported country code for VAT validation.",
      source: "VIES",
    };
  }

  const euCountries = new Set([
    "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR", "HR",
    "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK",
  ]);
  if (!euCountries.has(resolvedCountry)) {
    return {
      valid: false,
      countryCode: resolvedCountry,
      vatNumber: normalizedVat,
      message: "Unsupported country for VIES validation.",
      source: "VIES",
    };
  }

  const vatWithoutCountry = normalizedVat.startsWith(resolvedCountry)
    ? normalizedVat.slice(2)
    : normalizedVat;
  const url = `${VIES_BASE_URL}/ms/${resolvedCountry}/vat/${vatWithoutCountry}`;

  const startedAt = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), VIES_TIMEOUT_MS);
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timeout);

    const payload = (await response.json()) as ViesResponse;
    const valid = Boolean(payload.isValid);
    const message = valid
      ? "VAT ID verified successfully"
      : (payload.userError && payload.userError !== "INVALID"
          ? payload.userError
          : "Invalid VAT ID");

    logger.info(`[VIES] ${resolvedCountry}/${vatWithoutCountry} => ${valid ? "valid" : "invalid"} in ${Date.now() - startedAt}ms`);

    return {
      valid,
      countryCode: resolvedCountry,
      vatNumber: `${resolvedCountry}${vatWithoutCountry}`,
      companyName: payload.name && payload.name !== "---" ? payload.name : undefined,
      address: payload.address && payload.address !== "---" ? payload.address : undefined,
      message,
      source: "VIES",
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown error";
    logger.error(`[VIES] validation failed for ${resolvedCountry}/${vatWithoutCountry}: ${reason}`);
    return {
      valid: false,
      countryCode: resolvedCountry,
      vatNumber: `${resolvedCountry}${vatWithoutCountry}`,
      message: reason.includes("aborted") || reason.includes("timeout")
        ? "VAT validation timed out. Please try again later."
        : "VAT validation service is unavailable right now.",
      source: "VIES",
    };
  }
}
