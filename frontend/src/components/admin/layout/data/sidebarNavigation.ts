import {
  AlignLeft,
  Archive,
  Award,
  Calculator,
  CreditCard,
  DollarSign,
  FileText,
  Filter,
  Globe,
  Image,
  Languages,
  Layers,
  LayoutDashboard,
  Map,
  Menu,
  MessageSquare,
  Newspaper,
  Package,
  Palette,
  Percent,
  Settings,
  Shield,
  ShoppingCart,
  Sliders,
  Sparkles,
  Tag,
  Ticket,
  Truck,
  Users,
  Warehouse,
  Bell,
  RotateCw,
} from "lucide-react";

export interface SidebarSubItem {
  label: string;
  href: string;
  permission?: string;
  matchHrefs?: string[];
}

export interface SidebarItem {
  label: string;
  href?: string;
  icon: any;
  permission?: string;
  matchHrefs?: string[];
  subItems?: SidebarSubItem[];
}

export interface SidebarSection {
  title: string;
  items: SidebarItem[];
}

export const sidebarSections: SidebarSection[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
      { label: "Activity Logs", href: "/admin/logs", icon: FileText, permission: "logs.view" },
    ],
  },
  {
    title: "Commerce",
    items: [
      { label: "Orders", href: "/admin/orders", icon: ShoppingCart, permission: "orders.view" },
      { label: "Quote Requests", href: "/admin/quotes", icon: FileText, permission: "quotes.view" },
      { label: "Returns & Refunds", href: "/admin/returns", icon: RotateCw, permission: "orders.view" },
      { label: "Products", href: "/admin/products", icon: Package, permission: "products.view" },
      { label: "Inventory", href: "/admin/inventory", icon: Warehouse, permission: "inventory.view" },
      { label: "Warehouses", href: "/admin/warehouses", icon: Map, permission: "inventory.manage" },
      {
        label: "Catalog",
        icon: Tag,
        subItems: [
          { label: "Categories", href: "/admin/categories", permission: "categories.view" },
          { label: "Collections", href: "/admin/collections", permission: "collections.view" },
          { label: "Attributes", href: "/admin/attributes", permission: "attributes.view" },
          { label: "Product Filters", href: "/admin/product-filters", permission: "attributes.view" },
          { label: "Variants", href: "/admin/variants", permission: "variants.view" },
          { label: "Product Reviews", href: "/admin/reviews", permission: "reviews.view" },
        ],
      },
    ],
  },
  {
    title: "Pricing & Deals",
    items: [
      { label: "Price Lists", href: "/admin/pricing", icon: DollarSign, permission: "pricing.view" },
      { label: "Pricing Tiers", href: "/admin/tiers", icon: Award, permission: "tiers.view" },
      { label: "Discounts", href: "/admin/discounts", icon: Percent, permission: "discounts.view" },
      { label: "Coupons", href: "/admin/coupons", icon: Ticket, permission: "coupons.view" },
    ],
  },
  {
    title: "Customers",
    items: [
      { label: "Users & Customers", href: "/admin/customers", matchHrefs: ["/admin/users"], icon: Users, permission: "customers.view" },
      { label: "Inquiries", href: "/admin/contact-submissions", icon: MessageSquare, permission: "contactSubmissions.view" },
      { label: "Newsletter", href: "/admin/newsletter", icon: Newspaper, permission: "contactSubmissions.view" },
      { label: "Roles & Permissions", href: "/admin/roles", matchHrefs: ["/admin/customer-roles"], icon: Shield, permission: "roles.view" },
      {
        label: "Notifications",
        icon: Bell,
        permission: "customers.view",
        subItems: [
          { label: "History Logs", href: "/admin/notifications" },
          { label: "Routing Rules", href: "/admin/notifications/manager" },
          { label: "Template Studio", href: "/admin/notifications/templates" },
          { label: "Email Studio", href: "/admin/settings/email" },
          { label: "SMS Studio", href: "/admin/settings/sms" },
          { label: "WhatsApp Studio", href: "/admin/settings/whatsapp" },
        ],
      },
    ],
  },
  {
    title: "Global Operations",
    items: [
      {
        label: "Shipping",
        icon: Truck,
        permission: "shipping.view",
        subItems: [
          { label: "Providers", href: "/admin/shipping", permission: "shipping.view" },
          { label: "Zones", href: "/admin/shipping/zones", permission: "shipping.view" },
          { label: "Boxes", href: "/admin/shipping/boxes", permission: "shipping.view" },
        ],
      },
      { label: "Tax Configuration", href: "/admin/tax", icon: Calculator, permission: "tax.view" },
      {
        label: "Regions",
        icon: Globe,
        subItems: [
          { label: "Countries", href: "/admin/countries", permission: "countries.view" },
          { label: "Currencies", href: "/admin/currencies", permission: "currencies.view" },
        ],
      },
    ],
  },
  {
    title: "CMS / Pages",
    items: [
      { label: "CMS Pages", href: "/admin/cms/pages", icon: Newspaper, permission: "cms.view" },
      { label: "Menus", href: "/admin/cms/menus", icon: Menu, permission: "cms.view" },
      { label: "Footer", href: "/admin/cms/footer", icon: AlignLeft, permission: "cms.view" },
      { label: "Banners", href: "/admin/banners", icon: Image, permission: "cms.view" },
      { label: "Blog", href: "/admin/blogs", icon: FileText, permission: "cms.view" },
    ],

  },
  {
    title: "Platform",
    items: [
      { label: "Media Library", href: "/admin/media", icon: Image, permission: "media.view" },
      { label: "Archive", href: "/admin/archive", icon: Archive },
      { label: "Translations", href: "/admin/translations", icon: Languages, permission: "translations.view" },
      { label: "AI Tools", href: "/admin/ai-tools", icon: Sparkles, permission: "ai.view" },
      { label: "Payments", href: "/admin/payments", icon: CreditCard, permission: "payments.view" },
      { label: "Configuration", href: "/admin/configuration", icon: Sliders, permission: "settings.view" },
      { label: "Settings", href: "/admin/settings", icon: Settings, permission: "settings.view" },
      { label: "Storefront Theme", href: "/admin/settings/theme", icon: Palette, permission: "settings.view" },
    ],
  },
];
