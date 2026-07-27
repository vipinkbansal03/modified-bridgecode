import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { validateTaxIdentifier, clearVatValidationCache } from "./tax.service";

describe("VAT VIES validation", () => {
  beforeEach(() => {
    clearVatValidationCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    clearVatValidationCache();
    vi.restoreAllMocks();
  });

  it("validates a German VAT ID through VIES and returns normalized data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          isValid: true,
          name: "European Dental Supplies GmbH",
          address: "Berlin, Germany",
          vatNumber: "DE123456789",
        }),
      }),
    );

    const result = await validateTaxIdentifier("DE123456789", "VAT", "DE");

    expect(result.isValid).toBe(true);
    expect(result.taxId).toBe("DE123456789");
    expect(result.legalName).toBe("European Dental Supplies GmbH");
    expect(result.address).toBe("Berlin, Germany");
    expect(result.validatedBy).toBe("VIES");
  });

  it("marks invalid VAT IDs as invalid", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ isValid: false, userError: "INVALID" }),
      }),
    );

    const result = await validateTaxIdentifier("DE000000000", "VAT", "DE");

    expect(result.isValid).toBe(false);
    expect(result.message).toContain("Invalid VAT ID");
  });

  it("handles VIES timeout gracefully", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("timeout")),
    );

    const result = await validateTaxIdentifier("FR12345678901", "VAT", "FR");

    expect(result.isValid).toBe(false);
    expect(result.message).toContain("timed out");
  });

  it("returns unsupported-country feedback for non-EU VAT requests", async () => {
    const result = await validateTaxIdentifier("ZZ123456789", "VAT", "ZZ");

    expect(result.isValid).toBe(false);
    expect(result.message).toContain("Unsupported country");
  });

  it("uses cached VAT validation results for repeat requests", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ isValid: true, name: "Cached Company", address: "Paris", vatNumber: "FR12345678901" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const first = await validateTaxIdentifier("FR12345678901", "VAT", "FR");
    const second = await validateTaxIdentifier("FR12345678901", "VAT", "FR");

    expect(first.isValid).toBe(true);
    expect(second.isValid).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
