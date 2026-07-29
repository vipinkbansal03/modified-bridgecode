import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearTaxValidationCache, validateIdentifier } from "./taxValidation.service";
import * as gstClient from "./gstClient";

describe("TaxValidationService", () => {
  beforeEach(() => {
    clearTaxValidationCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    clearTaxValidationCache();
    vi.restoreAllMocks();
  });

  it("validates EU VAT IDs through VIES and returns normalized data", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        isValid: true,
        name: "European Dental Supplies GmbH",
        address: "Berlin, Germany",
        vatNumber: "DE123456789",
      }),
    }));

    const result = await validateIdentifier("DE123456789", "VAT", "DE");

    expect(result.isValid).toBe(true);
    expect(result.identifier).toBe("DE123456789");
    expect(result.identifierType).toBe("VAT");
    expect(result.companyName).toBe("European Dental Supplies GmbH");
    expect(result.countryCode).toBe("DE");
    expect(result.validationSource).toBe("VIES");
  });

  it("marks invalid EU VAT IDs as invalid", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ isValid: false, userError: "INVALID" }),
    }));

    const result = await validateIdentifier("DE000000000", "VAT", "DE");

    expect(result.isValid).toBe(false);
    expect(result.validationStatus).toBe("INVALID");
    expect(result.message).toContain("Invalid VAT ID");
  });

  it("validates GSTIN format when official API is not configured", async () => {
    const result = await validateIdentifier("27AAAAA1111A1Z5", "GSTIN", "IN");

    expect(result.isValid).toBe(true);
    expect(result.identifierType).toBe("GSTIN");
    expect(result.validationStatus).toBe("PENDING");
    expect(result.validationSource).toBe("GSTIN_FORMAT");
  });

  it("invalidates malformed GSTIN values", async () => {
    const result = await validateIdentifier("1234INVALID", "GSTIN", "IN");

    expect(result.isValid).toBe(false);
    expect(result.validationStatus).toBe("INVALID");
    expect(result.message).toContain("Invalid India GSTIN format");
  });

  it("returns pending EIN format validation for US customers", async () => {
    const result = await validateIdentifier("12-3456789", "EIN", "US");

    expect(result.isValid).toBe(true);
    expect(result.identifierType).toBe("EIN");
    expect(result.validationStatus).toBe("PENDING");
    expect(result.validationSource).toBe("LOCAL");
  });

  it("accepts a US resale certificate as local pending validation", async () => {
    const result = await validateIdentifier("RESALE-12345", "RESALE", "US");

    expect(result.isValid).toBe(true);
    expect(result.identifierType).toBe("RESALE_CERTIFICATE");
    expect(result.validationStatus).toBe("PENDING");
    expect(result.message).toContain("Admin approval is required");
  });

  it("caches successful VAT validations for repeat requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        isValid: true,
        name: "Cached Company",
        address: "Paris",
        vatNumber: "FR12345678901",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const first = await validateIdentifier("FR12345678901", "VAT", "FR");
    const second = await validateIdentifier("FR12345678901", "VAT", "FR");

    expect(first.isValid).toBe(true);
    expect(second.isValid).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to GSTIN format validation when GST API is unreachable", async () => {
    vi.spyOn(gstClient, "validateGstinWithApi").mockResolvedValue({
      valid: true,
      gstin: "27AAAAA1111A1Z5",
      companyName: null,
      address: null,
      message: "GSTIN format validated. Official GST validation API is not configured.",
      source: "GSTIN_FORMAT",
    });

    const result = await validateIdentifier("27AAAAA1111A1Z5", "GSTIN", "IN");

    expect(result.isValid).toBe(true);
    expect(result.validationStatus).toBe("PENDING");
    expect(result.validationSource).toBe("GSTIN_FORMAT");
    expect(result.message).toContain("GSTIN format validated");
  });
});
