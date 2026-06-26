/**
 * Public API hooks
 *
 * All data fetching for the public website goes through these hooks.
 * They automatically use:
 *   - The live Express backend by default
 *   - The bundled JSON files only when NEXT_PUBLIC_USE_STATIC_DATA=true
 *
 * Usage:
 *   import { useProducts, useProduct, useCategories } from "@/hooks/api";
 */

export { useProducts, useProductsByCategory, useProduct, useFeaturedProducts } from "./useProducts";
export type { ProductListParams } from "./useProducts";

export { useCategories } from "./useCategories";

export { useSearch } from "./useSearch";

export { useCurrencies, useCountries, useConvertPrice } from "./useCurrencies";
export { useAuthPageSettings } from "./useAuthPageSettings";
export type { AuthPageSettings, LoginSlideSetting } from "./useAuthPageSettings";
export { useCustomerRegister } from "./useCustomerRegister";
export {
  getCustomerMe,
  useCustomerLogin,
  useCustomerLogout,
  useCustomerMe,
} from "./useCustomerLogin";

export { useInventoryCheck } from "./useInventory";

export { useQuoteSubmit } from "./useQuoteSubmit";
export type { QuoteResult } from "./useQuoteSubmit";

export { useContactSubmit } from "./useContactSubmit";

export { useDealerInquiry } from "./useDealerInquiry";

export { useNewsletterSubmit } from "./useNewsletterSubmit";

export { useBlogs } from "./useBlogs";

export { useTestimonials } from "./useTestimonials";
