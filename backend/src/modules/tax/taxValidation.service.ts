import { logger } from "../../config/logger";
import { validateVatWithVies } from "./viesClient";
import { validateGstinWithApi } from "./gstClient";

const EU_COUNTRY_CODES = new Set([
  "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI", "FR", "GR", "HR",
  "HU", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PL", "PT", "RO", "SE", "SI", "SK",
]);

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const EIN_REGEX = /^[0-9]{2}-?[0-9]{7}$/;
const RESALE_CERTIFICATE_REGEX = /^[A-Z0-9\-\s]{5,100}$/;
const TAX_VALIDATION_CACHE_TTL_MS = Number(process.env.TAX_VALIDATION_CACHE_TTL_MS || 24 * 60 * 60 * 1000);

export type TaxValidationResult = {
  isValid: boolean;
  identifier: string;
  identifierType: "VAT" | "GSTIN" | "EIN" | "RESALE_CERTIFICATE" | "OTHER";
  validationStatus: "VALID" | "PENDING" | "INVALID";
  validationSource: string;
  countryCode: string;
  companyName?: string | null;
  companyAddress?: string | null;
  message: string;
  validatedAt: Date;
  taxId?: string;
};

const validationCache = new Map<string, { expiresAt: number; result: TaxValidationResult }>();

function cleanIdentifier(value: string) {
  return value.trim().replace(/[-\s]/g, "").toUpperCase();
}

function normalizeCountryCode(countryCode: string) {
  const normalized = countryCode.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : "";
}

function getCacheKey(identifier: string, countryCode: string, source: string) {
  return `${source}:${countryCode}:${identifier}`;
}

export function clearTaxValidationCache() {
  validationCache.clear();
}

function getCachedValidation(identifier: string, countryCode: string, source: string) {
  const key = getCacheKey(identifier, countryCode, source);
  const entry = validationCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    validationCache.delete(key);
    return null;
  }
  return entry.result;
}

function setCachedValidation(result: TaxValidationResult) {
  const key = getCacheKey(result.identifier, result.countryCode, result.validationSource);
  validationCache.set(key, { expiresAt: Date.now() + TAX_VALIDATION_CACHE_TTL_MS, result });
}

function isEuCountry(countryCode: string) {
  return EU_COUNTRY_CODES.has(countryCode);
}

async function validateEuVatIdentifier(identifier: string, countryCode: string): Promise<TaxValidationResult> {
  const cached = getCachedValidation(identifier, countryCode, "VIES");
  if (cached) {
    logger.info(`[TaxValidation] cache hit for ${cached.identifier}`);
    return { ...cached, validatedAt: new Date() };
  }

  const startedAt = Date.now();
  const viesResult = await validateVatWithVies(identifier, countryCode);
  const result: TaxValidationResult = {
    isValid: viesResult.valid,
    identifier: viesResult.vatNumber,
    identifierType: "VAT",
    validationStatus: viesResult.valid ? "VALID" : "INVALID",
    validationSource: viesResult.source,
    countryCode: viesResult.countryCode || countryCode,
    companyName: viesResult.companyName ?? null,
    companyAddress: viesResult.address ?? null,
    message: viesResult.message,
    validatedAt: new Date(),
    taxId: viesResult.vatNumber,
  };

  if (viesResult.valid) {
    setCachedValidation(result);
  }

  logger.info(`[TaxValidation] ${result.identifierType} ${result.identifier} => ${result.validationStatus.toLowerCase()} in ${Date.now() - startedAt}ms`);
  return result;
}

async function validateIndiaGstinIdentifier(identifier: string): Promise<TaxValidationResult> {
  const formatted = cleanIdentifier(identifier);
  const formatValid = GSTIN_REGEX.test(formatted);
  if (!formatValid) {
    return {
      isValid: false,
      identifier: formatted,
      identifierType: "GSTIN",
      validationStatus: "INVALID",
      validationSource: "GSTIN_FORMAT",
      countryCode: "IN",
      companyName: null,
      companyAddress: null,
      message: "Invalid India GSTIN format. Expected e.g., 03AAAAA1111A1Z1.",
      validatedAt: new Date(),
      taxId: formatted,
    };
  }

  const apiResult = await validateGstinWithApi(formatted);
  const validationStatus = apiResult.source === "GST_API" ? (apiResult.valid ? "VALID" : "INVALID") : "PENDING";
  const message = apiResult.source === "GSTIN_FORMAT"
    ? "GSTIN format validated. Official GST validation API is not configured."
    : apiResult.message;

  return {
    isValid: apiResult.valid,
    identifier: apiResult.gstin,
    identifierType: "GSTIN",
    validationStatus: validationStatus,
    validationSource: apiResult.source,
    countryCode: "IN",
    companyName: apiResult.companyName ?? null,
    companyAddress: apiResult.address ?? null,
    message,
    validatedAt: new Date(),
    taxId: apiResult.gstin,
  };
}

async function validateUsIdentifier(identifier: string, identifierType: string): Promise<TaxValidationResult> {
  const formatted = cleanIdentifier(identifier);

  if (identifierType === "RESALE" || /RESALE/i.test(identifier)) {
    return {
      isValid: true,
      identifier: formatted,
      identifierType: "RESALE_CERTIFICATE",
      validationStatus: "PENDING",
      validationSource: "LOCAL",
      countryCode: "US",
      companyName: null,
      companyAddress: null,
      message: "Resale certificate received. Admin approval is required for tax exemption.",
      validatedAt: new Date(),
      taxId: formatted,
    };
  }

  if (!EIN_REGEX.test(formatted)) {
    return {
      isValid: false,
      identifier: formatted,
      identifierType: "EIN",
      validationStatus: "INVALID",
      validationSource: "LOCAL",
      countryCode: "US",
      companyName: null,
      companyAddress: null,
      message: "Invalid US Federal EIN format. Expected 9-digit number.",
      validatedAt: new Date(),
      taxId: formatted,
    };
  }

  return {
    isValid: true,
    identifier: formatted,
    identifierType: "EIN",
    validationStatus: "PENDING",
    validationSource: "LOCAL",
    countryCode: "US",
    companyName: null,
    companyAddress: null,
    message: "EIN format validated. Admin approval is required for tax exemption.",
    validatedAt: new Date(),
    taxId: formatted,
  };
}

function validateGenericIdentifier(identifier: string, countryCode: string): TaxValidationResult {
  const formatted = cleanIdentifier(identifier);
  const valid = formatted.length >= 5;
  return {
    isValid: valid,
    identifier: formatted,
    identifierType: "OTHER",
    validationStatus: valid ? "VALID" : "INVALID",
    validationSource: "LOCAL",
    countryCode: countryCode || "",
    companyName: null,
    companyAddress: null,
    message: valid
      ? "Tax identifier format is accepted."
      : "Tax identifier is too short or malformed.",
    validatedAt: new Date(),
    taxId: formatted,
  };
}

export async function validateIdentifier(
  identifier: string,
  identifierType: string,
  countryCode: string,
): Promise<TaxValidationResult> {
  const normalizedType = identifierType.trim().toUpperCase();
  const normalizedCountryCode = normalizeCountryCode(countryCode);

  if (normalizedType === "VAT" || isEuCountry(normalizedCountryCode)) {
    return validateEuVatIdentifier(identifier, normalizedCountryCode);
  }

  if (normalizedType === "GSTIN" || normalizedCountryCode === "IN") {
    return validateIndiaGstinIdentifier(identifier);
  }

  if (normalizedType === "EIN" || normalizedType === "RESALE" || normalizedCountryCode === "US") {
    return validateUsIdentifier(identifier, normalizedType);
  }

  return validateGenericIdentifier(identifier, normalizedCountryCode);
}
