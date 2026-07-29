/**
 * Utility to format price amounts dynamically with currency symbol and locale-aware number formatting.
 */
export function formatPrice(
  amount: number | null | undefined,
  currencySymbol = "$",
  _currencyCode = "USD"
): string {
  if (amount == null || !Number.isFinite(Number(amount))) return "—";
  const num = Number(amount);
  const formatted = num.toLocaleString(undefined, {
    minimumFractionDigits: num % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return `${currencySymbol}${formatted}`;
}
