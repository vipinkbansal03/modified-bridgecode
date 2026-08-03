import type { CmsFooter, CmsMenu, CmsMenuItem } from "@/hooks/api/useCmsContent";
import type { NavLink, NavMegaGroup } from "@/types/common.types";

export const CMS_MENU_LOCATIONS = [
  { value: "header-primary", label: "Header Primary" },
  { value: "header-capabilities", label: "Header Capabilities" },
  { value: "header-products-mega", label: "Header Products Mega Menu" },
  { value: "header-cta", label: "Header CTA" },
  { value: "footer-about", label: "Footer About Column" },
  { value: "footer-products", label: "Footer Products Column" },
  { value: "footer-capabilities", label: "Footer Capabilities Column" },
  { value: "footer-dealers", label: "Footer Dealers Column" },
  { value: "footer-resources", label: "Footer Resources Column" },
  { value: "footer-export", label: "Footer Export Column" },
  { value: "footer-india-office", label: "Footer India Office Column" },
  { value: "footer-usa-office", label: "Footer USA Office Column" },
  { value: "footer-legal", label: "Footer Legal Links" },
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
