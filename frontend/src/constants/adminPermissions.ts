export type PermissionGroup = {
  title: string;
  permissions: string[];
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

export const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap(
  (group) => group.permissions,
);
