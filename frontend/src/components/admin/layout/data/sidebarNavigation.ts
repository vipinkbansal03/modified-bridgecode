import {
  AlignLeft,
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
} from "lucide-react";

export interface SidebarSubItem {
  label: string;
  href: string;
  permission?: string;
}

export interface SidebarItem {
  label: string;
  href?: string;
  icon: any;
  permission?: string;
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
      { label: "Products", href: "/admin/products", icon: Package, permission: "products.view" },
      { label: "Inventory", href: "/admin/inventory", icon: Warehouse, permission: "inventory.view" },
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
      { label: "Users & Customers", href: "/admin/customers", icon: Users, permission: "customers.view" },
      { label: "Inquiries", href: "/admin/contact-submissions", icon: MessageSquare, permission: "contactSubmissions.view" },
      { label: "Roles & Permissions", href: "/admin/roles", icon: Shield, permission: "roles.view" },
    ],
  },
  {
    title: "Global Operations",
    items: [
      { label: "Shipping", href: "/admin/shipping", icon: Truck, permission: "shipping.view" },
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
      { label: "Blog Posts", href: "/admin/blogs", icon: FileText, permission: "cms.view" },
      { label: "Blog Categories", href: "/admin/blogs/categories", icon: Tag, permission: "cms.view" },
      { label: "Blog Authors", href: "/admin/blogs/authors", icon: Users, permission: "cms.view" },
    ],
  },
  {
    title: "Platform",
    items: [
      { label: "Media Library", href: "/admin/media", icon: Image, permission: "media.view" },
      { label: "Translations", href: "/admin/translations", icon: Languages, permission: "translations.view" },
      { label: "AI Tools", href: "/admin/ai-tools", icon: Sparkles, permission: "ai.view" },
      { label: "Payments", href: "/admin/payments", icon: CreditCard, permission: "settings.view" },
      { label: "Settings", href: "/admin/settings", icon: Settings, permission: "settings.view" },
    ],
  },
];
