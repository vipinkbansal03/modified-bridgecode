import type { CmsFooter, CmsMenu, CmsMenuItem } from "@/hooks/api/useCmsContent";
import type { NavLink, NavMegaGroup } from "@/types/common.types";

export type CmsMenuCategoryGroup = "header" | "footer" | "offices_legal";

export interface CmsMenuLocationMeta {
  value: string;
  label: string;
  group: CmsMenuCategoryGroup;
  description: string;
}

export const CMS_MENU_LOCATIONS: readonly CmsMenuLocationMeta[] = [
  {
    value: "header-primary",
    label: "Header Primary Links",
    group: "header",
    description: "Appears in the main top header navigation bar (e.g. Products, Capabilities, About).",
  },
  {
    value: "header-capabilities",
    label: "Header Capabilities Menu",
    group: "header",
    description: "Appears under the Capabilities dropdown in the top header bar.",
  },
  {
    value: "header-products-mega",
    label: "Header Products Mega Menu",
    group: "header",
    description: "Multi-column category breakdown inside the Products mega dropdown.",
  },
  {
    value: "header-cta",
    label: "Header CTA Button Links",
    group: "header",
    description: "Quick action links/buttons displayed in the right side of the header.",
  },
  {
    value: "footer-about",
    label: "Footer About Column",
    group: "footer",
    description: "First main link column in the Storefront Footer under About Us.",
  },
  {
    value: "footer-products",
    label: "Footer Products Column",
    group: "footer",
    description: "Featured product category links column in the Storefront Footer.",
  },
  {
    value: "footer-capabilities",
    label: "Footer Capabilities Column",
    group: "footer",
    description: "Manufacturing & technology capability links in the Storefront Footer.",
  },
  {
    value: "footer-dealers",
    label: "Footer Dealers Column",
    group: "footer",
    description: "Distributor & partnership links column in the Storefront Footer.",
  },
  {
    value: "footer-resources",
    label: "Footer Resources Column",
    group: "footer",
    description: "Catalog downloads, guides, and policy links column in the Storefront Footer.",
  },
  {
    value: "footer-export",
    label: "Footer Export Column",
    group: "offices_legal",
    description: "Global export region information links in the Storefront Footer.",
  },
  {
    value: "footer-india-office",
    label: "Footer India Office Column",
    group: "offices_legal",
    description: "India headquarters contact & address links in the Storefront Footer.",
  },
  {
    value: "footer-usa-office",
    label: "Footer USA Office Column",
    group: "offices_legal",
    description: "USA corporate office contact & address links in the Storefront Footer.",
  },
  {
    value: "footer-legal",
    label: "Footer Legal Links",
    group: "offices_legal",
    description: "Copyright bottom bar legal policy links (Terms, Privacy, Disclaimers).",
  },
] as const;

export const CMS_MENU_LOCATION_VALUES = CMS_MENU_LOCATIONS.map((item) => item.value);

export type FooterSocialLinks = {
  facebook?: string;
  linkedin?: string;
  twitter?: string;
  instagram?: string;
};

export function parseFooterSocialLinks(value: unknown): FooterSocialLinks {
  if (!value || typeof value !== "object") return {};
  const data = value as Record<string, unknown>;
  return {
    facebook: typeof data.facebook === "string" ? data.facebook : "",
    linkedin: typeof data.linkedin === "string" ? data.linkedin : "",
    twitter: typeof data.twitter === "string" ? data.twitter : "",
    instagram: typeof data.instagram === "string" ? data.instagram : "",
  };
}

function activeItems(menu?: CmsMenu | null) {
  return (menu?.items ?? [])
    .filter((item) => (item.status ?? "ACTIVE") === "ACTIVE")
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function cmsMenuToLinks(menu?: CmsMenu | null): NavLink[] {
  return activeItems(menu)
    .filter((item) => !item.parentId)
    .map((item) => ({ label: item.label, href: item.url || "#" }));
}

export function cmsMenuToMegaGroups(menu?: CmsMenu | null): NavMegaGroup[] {
  const items = activeItems(menu);
  const parents = items.filter((item) => !item.parentId);
  return parents.map((parent) => ({
    label: parent.label,
    href: parent.url || "#",
    children: items
      .filter((item) => item.parentId === parent.id)
      .map((item) => ({ label: item.label, href: item.url || "#" })),
  }));
}

export function cmsMenuToFooterColumns(menu?: CmsMenu | null) {
  return {
    heading: menu?.name || "",
    links: activeItems(menu)
      .filter((item) => !item.parentId)
      .map((item) => {
        let href = item.url || "";
        let openInNewTab = Boolean(item.openInNewTab);

        if (href.startsWith("https://www.modortho.com") || href.startsWith("http://www.modortho.com")) {
          href = href.replace(/^https?:\/\/(www\.)?modortho\.com/, "");
          href = href.replace(/^\/page\//, "/");
          openInNewTab = false;
        }

        return {
          label: item.label,
          href,
          openInNewTab,
        };
      }),
  };
}

export function buildFooterCopyright(footer?: CmsFooter | null, fallback?: string) {
  return footer?.title?.trim() || fallback || "";
}

export function buildFooterNewsletterText(footer?: CmsFooter | null, fallback?: string) {
  return footer?.description?.trim() || fallback || "";
}

export function buildFooterContactFallback(footer?: CmsFooter | null) {
  return {
    email: footer?.email?.trim() || "",
    phone: footer?.phone?.trim() || "",
    address: footer?.address?.trim() || "",
  };
}

export function menuItemHref(item: CmsMenuItem) {
  return (item.url || "").trim();
}
