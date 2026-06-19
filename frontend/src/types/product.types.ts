export interface ProductHighlight {
  title: string;
  description: string;
}

export interface ProductSpec {
  label: string;
  value: string;
}

export interface ProductVariant {
  label: string;
  priceInPaise: number; // illustrative bulk-order price, in INR paise to avoid float issues
}

export interface FeaturedProduct {
  image: string;
  title: string;
  slug: string;
  category: string;
  shortDescription: string;
  price?: string;
  badge?: string;
  ctaLabel: string;
}

export interface ProductDetail {
  slug: string;
  title: string;
  category: string;
  categorySlug: string;
  productCode: string;
  images: string[];
  information: string;
  tagline?: string;
  highlights: ProductHighlight[];
  technicalSpecs: ProductSpec[];
  warranty: string[];
  primaryFeatures: ProductHighlight[];
  /** Configurator fields are optional — only present for products with a verified bulk-order flow. */
  prescriptionOptions?: string[];
  slotOptions?: string[];
  packagingOptions?: { label: string; unitPriceInr: number }[];
  discountTiers?: { thresholdInr: number; label: string; rate: number }[];
  catalogueUrl: string;
  bundle: { slug: string; title: string; image: string }[];
  seo: import("./common.types").SeoEntry;
}
