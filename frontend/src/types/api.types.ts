// ─── Public API types — mirror what public.service.ts returns ─────────────────

export interface ApiCategory {
  id: string;
  /** Display name (backend uses "name"; static JSON uses "title" — both are supported via the hook mapper) */
  name: string;
  /** Alias of name — populated from static JSON for backward compat with existing components */
  title: string;
  slug: string;
  description: string | null;
  image: string | null;
  productCount: number;
  /** Static-only fields — present when using bundled JSON, absent when using live API */
  doctorMeta?: string;
  dealerMeta?: string;
}

export interface ApiProductPrice {
  countryCode: string;
  countryName?: string;
  currencyCode: string;
  currencySymbol: string;
  mrp: number;
  sellingPrice: number;
  dealerPrice?: number | null;
}

export interface ApiAttributeValue {
  id: string;
  value: string;
  slug: string;
  sortOrder: number;
  image?: string | null;
  note?: string | null;
  priceAdjustment?: number;
}

export interface ApiAttribute {
  id: string;
  name: string;
  slug: string;
  required: boolean;
  values: ApiAttributeValue[];
}

export interface ApiVariantInventory {
  available: number;
  status: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK" | "BACKORDER";
}

export interface ApiVariant {
  id: string;
  title: string;
  sku: string | null;
  variantKey: string;
  package: { id: string; title: string; slug: string } | null;
  attributeCombination: Record<string, string>; // { "Prescription": "MBT", "Slot Size": ".022\"" }
  prices: ApiProductPrice[];
  inventory: ApiVariantInventory | null;
}

export interface ApiProductPackage {
  id: string;
  title: string;
  slug: string;
  image: string | null;
  description: string | null;
  sortOrder: number;
}

export interface ApiProductSummary {
  id: string;
  slug: string;
  title: string;
  productCode: string | null;
  brand: string;
  shortDescription: string | null;
  category: { name: string; slug: string };
  images: string[];
  thumbnail: string | null;
  isFeatured: boolean;
  hasVariants: boolean;
  variantCount: number;
  prices: ApiProductPrice[];
}

export interface ApiProductDetail extends Omit<ApiProductSummary, "images"> {
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string | null;
  images: { url: string; alt: string }[];
  documents: { url: string; label: string }[];
  packages: ApiProductPackage[];
  attributes: ApiAttribute[];
  variants: ApiVariant[];
}

export interface ApiSearchResult {
  products: ApiProductSummary[];
  categories: ApiCategory[];
}

export interface ApiCurrency {
  id: string;
  name: string;
  code: string;
  symbol: string;
  exchangeRate: string;
  isBase: boolean;
}

export interface ApiCountry {
  id: string;
  name: string;
  code: string;
  currency: ApiCurrency;
  isDefault: boolean;
}

export interface ApiLanguage {
  id: string;
  name: string;
  code: string;
  isDefault: boolean;
}

export interface ApiInventoryCheck {
  variantId: string;
  available: number;
  status: string;
}

export interface ApiQuoteSubmit {
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  companyName?: string;
  countryCode?: string;
  items: {
    productId: string;
    variantId?: string;
    productTitle: string;
    sku?: string;
    quantity: number;
    unitPrice?: number;
  }[];
  message?: string;
}

export interface ApiContactSubmit {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  country?: string;
  subject?: string;
  message: string;
  type?: "general" | "dealer" | "distributor" | "oem";
}
