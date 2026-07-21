// @ts-ignore
import { describe, it, expect } from "vitest";

function calculateCgstSgstSplit(totalTax: number) {
  const cgst = Math.round((totalTax / 2) * 100) / 100;
  const sgst = Math.round((totalTax - cgst) * 100) / 100;
  return { cgst, sgst };
}

function computeOrderTotal(subtotal: number, taxTotal: number, taxMode: "INCLUSIVE" | "EXCLUSIVE" | "EXEMPT", shippingCharge = 0, discount = 0) {
  const exclusiveTaxAmount = taxMode === "EXCLUSIVE" ? taxTotal : 0;
  return Math.round((subtotal + exclusiveTaxAmount + shippingCharge - discount) * 100) / 100;
}

describe("Tax Rounding Split (CGST + SGST)", () => {
  it("asserts cgst + sgst === totalTax exactly for 2705.01, 999.99, and 1.00", () => {
    const testCases = [2705.01, 999.99, 1.00, 15.03, 173.23];

    for (const totalTax of testCases) {
      const { cgst, sgst } = calculateCgstSgstSplit(totalTax);
      const sum = Math.round((cgst + sgst) * 100) / 100;
      expect(sum).toBe(totalTax);
    }
  });
});

describe("Inclusive vs Exclusive Order Total Calculation", () => {
  it("INCLUSIVE mode: charged total equals subtotal (tax is inside, not added on top)", () => {
    const subtotal = 15030;
    const taxTotal = 2293;
    const total = computeOrderTotal(subtotal, taxTotal, "INCLUSIVE");
    expect(total).toBe(15030); // NO DOUBLE CHARGING
  });

  it("EXCLUSIVE mode: charged total equals subtotal + tax amount", () => {
    const subtotal = 15030;
    const taxTotal = 2705.40;
    const total = computeOrderTotal(subtotal, taxTotal, "EXCLUSIVE");
    expect(total).toBe(17735.40);
  });

  it("EXEMPT mode: charged total equals subtotal", () => {
    const subtotal = 15030;
    const taxTotal = 0;
    const total = computeOrderTotal(subtotal, taxTotal, "EXEMPT");
    expect(total).toBe(15030);
  });
});
