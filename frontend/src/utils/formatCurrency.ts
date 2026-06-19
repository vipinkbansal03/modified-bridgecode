/**
 * Formats a number of rupees as "Rs. 4,500" style currency text.
 * Avoids the Intl currency symbol so it renders consistently across locales/fonts.
 */
export function formatCurrency(amountInr: number): string {
  const rounded = Math.round(amountInr || 0);
  return `Rs. ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(rounded)}`;
}
