import type { StaticMessageKey } from "./staticMessages";

export type StaticSectionId =
  | "pdp"
  | "navigation"
  | "cart_quote"
  | "catalog_filters"
  | "home"
  | "quality"
  | "footer"
  | "common";

export interface StaticSectionMeta {
  id: StaticSectionId;
  label: string;
  icon: string;
  description: string;
}

export const STATIC_SECTIONS: StaticSectionMeta[] = [
  {
    id: "pdp",
    label: "Product Detail Page",
    icon: "🛍️",
    description: "Buttons, badges, shipping banners, configurator text, specifications, and tabs on product pages",
  },
  {
    id: "navigation",
    label: "Header & Navigation",
    icon: "🧭",
    description: "Top navigation links, search bars, account buttons, and mega-menu category names",
  },
  {
    id: "cart_quote",
    label: "Cart & RFQ Quote",
    icon: "🛒",
    description: "Shopping cart drawer, quote request modal, volume discount badges, and checkout buttons",
  },
  {
    id: "catalog_filters",
    label: "Products Catalog & Filters",
    icon: "🏷️",
    description: "Product list page, sidebar filters (Bracket, Material, Slot, etc.), sort dropdowns, and stock badges",
  },
  {
    id: "home",
    label: "Home Page",
    icon: "🏠",
    description: "Hero headers, doctor testimonials, location cards, and homepage call-to-action blocks",
  },
  {
    id: "quality",
    label: "Quality & Certifications",
    icon: "🛡️",
    description: "ISO standards, CE marking, FDA registration, MSDS documents, and packaging symbol guides",
  },
  {
    id: "footer",
    label: "Footer & Legal",
    icon: "📄",
    description: "Footer columns, office addresses, copyright notice, and legal links",
  },
  {
    id: "common",
    label: "Common & Dialogs",
    icon: "⚙️",
    description: "Next/Previous buttons, general pagination, loading indicators, and contact CTA cards",
  },
];

export interface StaticKeyMetadata {
  friendlyName: string;
  section: StaticSectionId;
  context: string;
}

export function getStaticKeyMetadata(key: StaticMessageKey): StaticKeyMetadata {
  // 1. PDP
  if (key.startsWith("ui.pdp.")) {
    const sub = key.replace("ui.pdp.", "");
    const friendlyMap: Record<string, { name: string; context: string }> = {
      backToProducts: { name: "Back to Products Link", context: "Top breadcrumb navigation link on product page" },
      startingAt: { name: "Starting at Label", context: "Text shown before base product selling price" },
      mrp: { name: "M.R.P. Label", context: "Maximum Retail Price prefix before struck-through price" },
      percentOff: { name: "Discount Percent Badge", context: "Badge showing percentage off MRP (e.g. 20% OFF)" },
      taxExempt: { name: "Tax Exempt Badge", context: "Shown when tax mode is zero/exempt for product" },
      priceUponRequest: { name: "Price Upon Request Badge", context: "Shown when product price is quote-only" },
      pricingViaQuote: { name: "Custom Quote Pricing Subtitle", context: "Helper message when pricing is custom quote" },
      pricingNotAvailableOnline: { name: "Online Pricing Unavailable Notice", context: "Shown when base product price is not published online" },
      buyNow: { name: "Buy Now Button", context: "Primary buy button on variant buy box" },
      addToCart: { name: "Add to Cart Button", context: "Button to add single product configuration to cart" },
      addingToCart: { name: "Adding to Cart (Loading State)", context: "Button label while adding item to cart" },
      continueShopping: { name: "Continue Shopping Button", context: "Button next to add to cart to browse more items" },
      requestPricing: { name: "Request Pricing Button", context: "Button when product has no online price" },
      savedToWishlist: { name: "Saved to Wishlist Label", context: "Wishlist button text when active" },
      addToWishlist: { name: "Add to Wishlist Label", context: "Wishlist button text when inactive" },
      perkMedicalGrade: { name: "Perk 1: 100% Medical Grade", context: "Trust perk badge below buy box" },
      perkDirectDispatch: { name: "Perk 2: Direct Dispatch", context: "Trust perk badge below buy box" },
      perkSecureCheckout: { name: "Perk 3: Secure Checkout", context: "Trust perk badge below buy box" },
      information: { name: "Information Header", context: "Section title for clinical product description box" },
      productCode: { name: "Product Code Label", context: "Prefix before SKU/part code (e.g. Product Code:)" },
      downloadCatalogue: { name: "Download Catalogue Button", context: "PDF download button on product page" },
      viewSpecs: { name: "View Specifications Link", context: "Quick anchor jump link to specifications tab" },
      shippingTitle: { name: "Shipping Banner Title", context: "Fast dispatch banner headline on product page" },
      shippingSubtitle: { name: "Shipping Banner Subtitle", context: "Warehouse dispatch timeline & free shipping threshold" },
      sidebarTitle: { name: "Sidebar Title: All Products", context: "Title of left product browser list" },
      sidebarSearchPlaceholder: { name: "Sidebar Search Placeholder", context: "Search box inside left product list" },
      sidebarNoProducts: { name: "Sidebar No Products Found", context: "Empty search state in sidebar" },
      sidebarLoadingMore: { name: "Sidebar Loading Indicator", context: "Infinite scroll loading spinner text" },
      availabilityStatus: { name: "Availability Status Label", context: "Header above stock badge in configurator" },
      quantity: { name: "Quantity Label", context: "Label above quantity selector" },
      maxUnits: { name: "Max Units Available Text", context: "Shown as Max {count} in base configurator" },
      estimation: { name: "Estimation Summary Label", context: "Label before unit price calculation" },
      subtotal: { name: "Subtotal Label", context: "Label before calculated line subtotal" },
      volumeDiscounts: { name: "Volume & Tier Discounts Title", context: "Header of volume discount pricing box" },
      tierPricing: { name: "Tier Pricing Subtitle", context: "Subtitle above customer tier discounts" },
      moqPricing: { name: "Volume MOQ Pricing Subtitle", context: "Subtitle above quantity volume break prices" },
      tabFeatures: { name: "Tab: Features", context: "First horizontal product tab title" },
      tabDescription: { name: "Tab: Description", context: "Second horizontal product tab title" },
      tabSpecs: { name: "Tab: Key Specifications", context: "Third horizontal product tab title" },
      tabUsage: { name: "Tab: Direction To Use", context: "Fourth horizontal product tab title" },
      tabAdditional: { name: "Tab: Additional Info", context: "Fifth horizontal product tab title" },
      tabReviews: { name: "Tab: Reviews & Feedback", context: "Sixth horizontal product tab title" },
      featuresHeading: { name: "Features Section Headline", context: "Heading inside Features tab panel" },
      descriptionHeading: { name: "Description Section Headline", context: "Heading inside Description tab panel" },
      specsHeading: { name: "Specifications Section Headline", context: "Heading inside Key Specifications tab panel" },
      specsBadge: { name: "Specifications Standards Badge", context: "ISO 13485 badge inside specifications tab" },
      specsDiagrams: { name: "Specification Diagrams Header", context: "Title above technical diagram carousel" },
      clickToZoom: { name: "Click to Zoom Badge", context: "Hover badge on technical diagrams" },
      specsNotes: { name: "Specifications Clinical Footnote", context: "Standard dimensions & tolerances footnote" },
      usageHeading: { name: "Direction To Use Headline", context: "Heading inside Direction To Use tab panel" },
      additionalHeading: { name: "Additional Info Headline", context: "Heading inside Additional Info tab panel" },
      noAdditionalInfo: { name: "No Additional Info Message", context: "Fallback message when no custom fields exist" },
      reviewsHeading: { name: "Customer Reviews Headline", context: "Heading inside Reviews & Feedback tab panel" },
      outOfFive: { name: "Rating Scale Text", context: "Shown as 'out of 5' in rating box" },
      basedOnReviews: { name: "Review Count Text", context: "Shown as 'Based on {count} verified customer {label}'" },
      productQuality: { name: "Product Quality Rating Label", context: "Score metric label in review box" },
      valueForMoney: { name: "Value for Money Rating Label", context: "Score metric label in review box" },
      verifiedBuyer: { name: "Verified Buyer Badge", context: "Pill badge next to customer review author" },
      loadingReviews: { name: "Loading Reviews Indicator", context: "Placeholder while fetching review data" },
      feedbackPrompt: { name: "Feedback Prompt Headline", context: "Dentalkart style feedback prompt banner" },
      feedbackButton: { name: "Feedback Button Label", context: "Button label to open feedback dialog" },
      feedbackModalTitle: { name: "Feedback Modal Title", context: "Header of feedback popup dialog" },
      submitFeedback: { name: "Submit Feedback Button", context: "Primary submit button in feedback modal" },
      submittingFeedback: { name: "Submitting Feedback (Loading)", context: "Loading state while submitting review" },
      feedbackLoginPrompt: { name: "Feedback Login Notice", context: "Message when user is not logged in" },
      selectedVariant: { name: "Selected Variant Badge", context: "Badge above configured variant in matrix" },
      unitPrice: { name: "Unit Price Label", context: "Header above unit price in configurator" },
      matrixGridTitle: { name: "Matrix Grid Title", context: "Title above multi-variant order grid" },
      matrixGridSubtitle: { name: "Matrix Grid Subtitle", context: "Helper instructions for matrix cells" },
      selectDropdownHelper: { name: "Select Dropdown Options Helper", context: "Prompt shown before dropdowns are picked" },
      shipsFrom: { name: "Ships From Warehouse Badge", context: "Badge showing warehouse fulfillment location" },
    };

    if (friendlyMap[sub]) {
      return { friendlyName: friendlyMap[sub].name, section: "pdp", context: friendlyMap[sub].context };
    }
    return { friendlyName: sub.replace(/([A-Z])/g, " $1").trim(), section: "pdp", context: "Product Detail Page" };
  }

  // 2. Stock Badges
  if (key.startsWith("ui.stock.")) {
    const sub = key.replace("ui.stock.", "");
    return {
      friendlyName: `Stock Badge: ${sub.replace(/([A-Z])/g, " $1").trim()}`,
      section: "catalog_filters",
      context: "Inventory status indicator on product catalog, variant cards, and PDP",
    };
  }

  // 3. Navigation & Mega Menu
  if (key.startsWith("ui.nav.") || key.startsWith("ui.mega.")) {
    const isMega = key.startsWith("ui.mega.");
    const sub = key.replace(/^ui\.(nav|mega)\./, "");
    return {
      friendlyName: isMega ? `Mega Menu: ${sub.replace(/([A-Z])/g, " $1").trim()}` : `Nav: ${sub.replace(/([A-Z])/g, " $1").trim()}`,
      section: "navigation",
      context: isMega ? "Header dropdown navigation menu category" : "Top header bar & main navigation links",
    };
  }

  // 4. Cart & Quote
  if (key.startsWith("ui.cart.") || key.startsWith("ui.quote.")) {
    const isQuote = key.startsWith("ui.quote.");
    const sub = key.replace(/^ui\.(cart|quote)\./, "");
    return {
      friendlyName: `${isQuote ? "Quote" : "Cart"}: ${sub.replace(/([A-Z])/g, " $1").trim()}`,
      section: "cart_quote",
      context: isQuote ? "Request for Quote (RFQ) drawer & form" : "Storefront shopping cart drawer & line items",
    };
  }

  // 5. Products Listing, PDP & Filters
  if (key.startsWith("ui.products.") || key.startsWith("ui.filters.") || key.startsWith("ui.search.")) {
    const sub = key.replace(/^ui\.(products|filters|search)\./, "");
    
    // PDP specific ui.products keys
    if (key === "ui.products.selectVariantsHelper") {
      return {
        friendlyName: "Variant Selection Helper Text",
        section: "pdp",
        context: "Instruction prompt shown above dropdowns/variant matrix on Product Detail Page",
      };
    }
    if (key === "ui.products.taxesAtCheckout") {
      return {
        friendlyName: "Taxes Calculated at Checkout Notice",
        section: "pdp",
        context: "Tax calculation note shown below price on Product Detail Page",
      };
    }
    if (key === "ui.products.taxInclusive") {
      return {
        friendlyName: "Inclusive of All Taxes Notice",
        section: "pdp",
        context: "Tax inclusion badge shown below price on Product Detail Page",
      };
    }
    if (key === "ui.products.matrixConfiguratorBadge") {
      return {
        friendlyName: "Matrix Configurator Badge",
        section: "pdp",
        context: "Badge title above matrix ordering table on Product Detail Page",
      };
    }
    if (key === "ui.products.dealerPricing") {
      return {
        friendlyName: "Dealer Tiered Pricing Notice",
        section: "pdp",
        context: "Notice for wholesale dealer pricing options on Product Detail Page",
      };
    }
    if (key === "ui.products.title") {
      return {
        friendlyName: "All Products Page Headline",
        section: "catalog_filters",
        context: "Top headline banner text on the All Products listing page (/products)",
      };
    }
    if (key === "ui.products.description") {
      return {
        friendlyName: "All Products Page Subtitle & Description",
        section: "catalog_filters",
        context: "Top subtitle and intro paragraph on the All Products listing page (/products)",
      };
    }
    if (key === "ui.products.allProducts") {
      return {
        friendlyName: "All Products Title",
        section: "pdp",
        context: "Title of left product list sidebar on PDP and catalog",
      };
    }
    if (key === "ui.products.breadcrumbHome") {
      return {
        friendlyName: "Breadcrumb: Home",
        section: "pdp",
        context: "Home breadcrumb navigation link on product pages and catalog",
      };
    }
    if (key === "ui.products.breadcrumbProducts") {
      return {
        friendlyName: "Breadcrumb: Products",
        section: "pdp",
        context: "Products breadcrumb navigation link on product pages and catalog",
      };
    }
    return {
      friendlyName: sub.replace(/([A-Z])/g, " $1").trim(),
      section: "catalog_filters",
      context: "Products listing page, search modal, category filters, and sorting controls",
    };
  }

  // 6. Home & Locations
  if (key.startsWith("ui.home.") || key.startsWith("ui.location.") || key.startsWith("ui.blog.")) {
    const sub = key.replace(/^ui\.(home|location|blog)\./, "");
    return {
      friendlyName: sub.replace(/([A-Z])/g, " $1").trim(),
      section: "home",
      context: "Home page sections, testimonials, global locations, and blog previews",
    };
  }

  // 7. Quality & Certifications
  if (key.startsWith("ui.quality.")) {
    const sub = key.replace("ui.quality.", "");
    return {
      friendlyName: `Quality: ${sub.replace(/([A-Z])/g, " $1").trim()}`,
      section: "quality",
      context: "ISO certifications, CE marks, FDA registration, MSDS info, and symbol definitions",
    };
  }

  // 8. Footer & Contact
  if (key.startsWith("ui.footer.") || key.startsWith("ui.contactCta.")) {
    const sub = key.replace(/^ui\.(footer|contactCta)\./, "");
    return {
      friendlyName: sub.replace(/([A-Z])/g, " $1").trim(),
      section: "footer",
      context: "Footer navigation links, company address, and contact CTA cards",
    };
  }

  // Fallback
  return {
    friendlyName: key.replace(/^ui\./, "").replace(/\./g, " > ").replace(/([A-Z])/g, " $1").trim(),
    section: "common",
    context: "General storefront interface label",
  };
}
