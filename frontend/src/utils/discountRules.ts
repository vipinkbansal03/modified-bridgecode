export const VOLUME_TIERS = [
  { minValue: 50000, percentage: 15 },
  { minValue: 25000, percentage: 10 },
] as const;

export function discountPercentage(subtotal: number): number {
  for (const tier of VOLUME_TIERS) {
    if (subtotal >= tier.minValue) return tier.percentage;
  }
  return 0;
}

export function applyDiscount(subtotal: number): { percentage: number; amount: number; grandTotal: number } {
  const pct = discountPercentage(subtotal);
  const amount = (subtotal * pct) / 100;
  return { percentage: pct, amount, grandTotal: subtotal - amount };
}

export function nextDiscountTier(subtotal: number): { minValue: number; percentage: number } | null {
  const sorted = [...VOLUME_TIERS].sort((a, b) => a.minValue - b.minValue);
  return sorted.find((t) => t.minValue > subtotal) ?? null;
}
