export interface SeoEntry {
  title: string;
  description: string;
  keywords?: string[];
  ogImage?: string;
  canonical?: string;
  robots?: string;
}

export interface NavLink {
  label: string;
  href: string;
}

export interface NavMegaGroup {
  label: string;
  href: string;
  children: NavLink[];
}

export interface NavigationData {
  primary: (NavLink & { children?: NavLink[] })[];
  productMegaMenu: NavMegaGroup[];
  capabilitiesMenu: NavLink[];
  subNav: NavLink[];
  ctaLabel: string;
  ctaHref: string;
}

export interface StatItem {
  label: string;
  value: string;
  description: string;
}

export interface CertificationItem {
  title: string;
  description: string;
  icon: string;
  href?: string;
}

export interface LocationPin {
  id: string;
  xPct: number;
  yPct: number;
  category: "hq" | "export" | "dealer";
  label: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface CapabilityBox {
  icon: string;
  title: string;
  description: string;
  linkLabel?: string;
  linkHref?: string;
}

export interface DetailPageContent {
  slug: string;
  kicker: string;
  title: string;
  lede: string;
  heroImage: string;
  subnav: { label: string; anchor: string }[];
  sections: {
    id: string;
    heading: string;
    paragraphs?: string[];
    capabilityGrid?: CapabilityBox[];
    symbolGrid?: { icon: string; title: string; description: string }[];
    callout?: { text: string };
  }[];
  faqs: FaqItem[];
  seo: SeoEntry;
}
