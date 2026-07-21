export type PermissionMeta = {
  key: string;
  label: string;
  description: string;
  group: "Catalog" | "Operations" | "Content" | "Administration";
};

export type PermissionGroup = {
  title: "Catalog" | "Operations" | "Content" | "Administration";
  permissions: string[];
};

export const PERMISSION_METADATA: Record<string, PermissionMeta> = {
  // --- Catalog ---
  "products.view": { key: "products.view", label: "View Products", description: "Allows viewing product catalog, details, and listings", group: "Catalog" },
  "products.create": { key: "products.create", label: "Create Products", description: "Allows creating new products in catalog", group: "Catalog" },
  "products.update": { key: "products.update", label: "Edit Products", description: "Allows editing existing product details and pricing", group: "Catalog" },
  "products.delete": { key: "products.delete", label: "Delete Products", description: "Allows permanently removing products", group: "Catalog" },
  "categories.view": { key: "categories.view", label: "View Categories", description: "Allows viewing product category tree", group: "Catalog" },
  "categories.manage": { key: "categories.manage", label: "Manage Categories", description: "Allows creating, editing, and sorting categories", group: "Catalog" },
  "collections.view": { key: "collections.view", label: "View Collections", description: "Allows viewing featured product collections", group: "Catalog" },
  "collections.manage": { key: "collections.manage", label: "Manage Collections", description: "Allows creating and arranging collections", group: "Catalog" },
  "attributes.view": { key: "attributes.view", label: "View Attributes", description: "Allows viewing product variants and attributes", group: "Catalog" },
  "attributes.manage": { key: "attributes.manage", label: "Manage Attributes", description: "Allows editing specifications and variant options", group: "Catalog" },

  // --- Operations ---
  "inventory.view": { key: "inventory.view", label: "View Inventory", description: "Allows inspecting stock levels across warehouses", group: "Operations" },
  "inventory.manage": { key: "inventory.manage", label: "Manage Inventory", description: "Allows adjusting stock counts and low-stock alerts", group: "Operations" },
  "orders.view": { key: "orders.view", label: "View Orders", description: "Allows viewing customer order history and details", group: "Operations" },
  "orders.manage": { key: "orders.manage", label: "Manage Orders", description: "Allows updating order status, shipments, and refunds", group: "Operations" },
  "quotes.view": { key: "quotes.view", label: "View Quote Requests", description: "Allows viewing custom wholesale price quotes", group: "Operations" },
  "quotes.manage": { key: "quotes.manage", label: "Manage Quote Requests", description: "Allows responding to and converting B2B quotes", group: "Operations" },
  "contactSubmissions.view": { key: "contactSubmissions.view", label: "View Inquiries", description: "Allows reading contact form submissions", group: "Operations" },
  "contactSubmissions.manage": { key: "contactSubmissions.manage", label: "Manage Inquiries", description: "Allows replying to customer contact messages", group: "Operations" },
  "shipping.view": { key: "shipping.view", label: "View Shipping Methods", description: "Allows viewing shipping rates and rules", group: "Operations" },
  "shipping.manage": { key: "shipping.manage", label: "Manage Shipping", description: "Allows updating shipping zones and delivery rates", group: "Operations" },
  "coupons.view": { key: "coupons.view", label: "View Coupons", description: "Allows viewing active promo codes and discounts", group: "Operations" },
  "coupons.manage": { key: "coupons.manage", label: "Manage Coupons", description: "Allows creating and disabling discount coupons", group: "Operations" },
  "discounts.view": { key: "discounts.view", label: "View Pricing Rules", description: "Allows inspecting automatic tiered discount rules", group: "Operations" },
  "discounts.manage": { key: "discounts.manage", label: "Manage Pricing Rules", description: "Allows configuring bulk price matrix rules", group: "Operations" },
  "pricing.view": { key: "pricing.view", label: "View Price Lists", description: "Allows viewing B2B price lists and currencies", group: "Operations" },
  "pricing.manage": { key: "pricing.manage", label: "Manage Price Lists", description: "Allows configuring wholesale price list tables", group: "Operations" },

  // --- Content ---
  "cms.view": { key: "cms.view", label: "View CMS Pages", description: "Allows viewing static content pages and blogs", group: "Content" },
  "cms.manage": { key: "cms.manage", label: "Manage CMS Pages", description: "Allows editing website pages, banners, and blogs", group: "Content" },
  "media.view": { key: "media.view", label: "View Media Library", description: "Allows inspecting uploaded photos and documents", group: "Content" },
  "media.manage": { key: "media.manage", label: "Manage Media Library", description: "Allows uploading and removing image files", group: "Content" },
  "translations.view": { key: "translations.view", label: "View Translations", description: "Allows viewing multi-language product translations", group: "Content" },
  "translations.manage": { key: "translations.manage", label: "Manage Translations", description: "Allows editing multi-language translation strings", group: "Content" },
  "ai.manage": { key: "ai.manage", label: "Use AI Content Generators", description: "Allows generating automatic descriptions and translations", group: "Content" },

  // --- Administration ---
  "countries.view": { key: "countries.view", label: "View Countries", description: "Allows inspecting enabled regional markets", group: "Administration" },
  "countries.manage": { key: "countries.manage", label: "Manage Countries", description: "Allows enabling/disabling regional storefronts", group: "Administration" },
  "currencies.view": { key: "currencies.view", label: "View Currencies", description: "Allows viewing exchange rates and multi-currency", group: "Administration" },
  "currencies.manage": { key: "currencies.manage", label: "Manage Currencies", description: "Allows updating exchange rates and default currency", group: "Administration" },
  "customers.view": { key: "customers.view", label: "View Customers", description: "Allows inspecting B2B & retail customer accounts", group: "Administration" },
  "customers.manage": { key: "customers.manage", label: "Manage Customers", description: "Allows approving B2B doctor/retailer accounts", group: "Administration" },
  "users.view": { key: "users.view", label: "View System Users", description: "Allows inspecting admin team member accounts", group: "Administration" },
  "users.manage": { key: "users.manage", label: "Manage System Users & Roles", description: "Allows creating admins, staff, and assigning roles", group: "Administration" },
  "roles.view": { key: "roles.view", label: "View System Roles", description: "Allows viewing role permission lists", group: "Administration" },
  "roles.manage": { key: "roles.manage", label: "Manage System Roles", description: "Allows creating and configuring custom roles", group: "Administration" },
  "settings.manage": { key: "settings.manage", label: "Manage Store Settings", description: "Allows updating store info, branding, and tax settings", group: "Administration" },
  "logs.view": { key: "logs.view", label: "View System Activity Logs", description: "Allows inspecting admin audit trails and security logs", group: "Administration" },
};

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    title: "Catalog",
    permissions: [
      "products.view",
      "products.create",
      "products.update",
      "products.delete",
      "categories.view",
      "categories.manage",
      "collections.view",
      "collections.manage",
      "attributes.view",
      "attributes.manage",
    ],
  },
  {
    title: "Operations",
    permissions: [
      "inventory.view",
      "inventory.manage",
      "orders.view",
      "orders.manage",
      "quotes.view",
      "quotes.manage",
      "contactSubmissions.view",
      "contactSubmissions.manage",
      "shipping.view",
      "shipping.manage",
      "coupons.view",
      "coupons.manage",
      "discounts.view",
      "discounts.manage",
      "pricing.view",
      "pricing.manage",
    ],
  },
  {
    title: "Content",
    permissions: [
      "cms.view",
      "cms.manage",
      "media.view",
      "media.manage",
      "translations.view",
      "translations.manage",
      "ai.manage",
    ],
  },
  {
    title: "Administration",
    permissions: [
      "countries.view",
      "countries.manage",
      "currencies.view",
      "currencies.manage",
      "customers.view",
      "customers.manage",
      "users.view",
      "users.manage",
      "roles.view",
      "roles.manage",
      "settings.manage",
      "logs.view",
    ],
  },
];

export const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((g) => g.permissions);

export interface RolePreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  permissions: string[];
}

export const ROLE_PRESETS: RolePreset[] = [
  {
    id: "super_admin",
    name: "Super Admin",
    description: "Full unrestricted system access (* Wildcard)",
    icon: "👑",
    permissions: ["*"],
  },
  {
    id: "store_manager",
    name: "Store Manager",
    description: "Full management of Products, Orders, Customers & Content",
    icon: "🏬",
    permissions: [
      "products.view", "products.create", "products.update", "categories.view", "categories.manage",
      "collections.view", "collections.manage", "attributes.view", "attributes.manage",
      "inventory.view", "inventory.manage", "orders.view", "orders.manage", "quotes.view", "quotes.manage",
      "contactSubmissions.view", "contactSubmissions.manage", "customers.view", "customers.manage",
      "cms.view", "cms.manage", "media.view", "media.manage"
    ],
  },
  {
    id: "catalog_manager",
    name: "Catalog Manager",
    description: "Manages Product Catalog, Categories, Variants & Media",
    icon: "📦",
    permissions: [
      "products.view", "products.create", "products.update", "categories.view", "categories.manage",
      "collections.view", "collections.manage", "attributes.view", "attributes.manage",
      "media.view", "media.manage", "translations.view", "translations.manage", "ai.manage"
    ],
  },
  {
    id: "fulfillment_executive",
    name: "Fulfillment Executive",
    description: "Processes Orders, Shipping, Inventory & Stock counts",
    icon: "🚚",
    permissions: [
      "orders.view", "orders.manage", "inventory.view", "inventory.manage",
      "shipping.view", "shipping.manage", "products.view"
    ],
  },
  {
    id: "support_agent",
    name: "Customer Support Agent",
    description: "Handles Customer Accounts, Inquiries & B2B Quote requests",
    icon: "📞",
    permissions: [
      "customers.view", "customers.manage", "quotes.view", "quotes.manage",
      "contactSubmissions.view", "contactSubmissions.manage", "orders.view"
    ],
  },
  {
    id: "read_only",
    name: "Read-Only Auditor",
    description: "View-only access across all catalog, orders, and reports",
    icon: "👁️",
    permissions: [
      "products.view", "categories.view", "collections.view", "attributes.view",
      "inventory.view", "orders.view", "quotes.view", "contactSubmissions.view",
      "shipping.view", "coupons.view", "discounts.view", "pricing.view",
      "cms.view", "media.view", "translations.view", "customers.view", "logs.view"
    ],
  },
];
