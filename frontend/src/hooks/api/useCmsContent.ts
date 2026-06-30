import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { STALE } from "@/lib/queryConfig";

export type CmsBlock = {
  id: string;
  blockType: string;
  title?: string | null;
  subtitle?: string | null;
  description?: string | null;
  image?: string | null;
  icon?: string | null;
  linkLabel?: string | null;
  linkUrl?: string | null;
  dataJson?: unknown;
  sortOrder: number;
};

export type CmsTranslationMap = Record<string, Array<{ languageId: string; value: string; language?: { id: string; name: string; code: string } }>>;

export type CmsSection = {
  id: string;
  sectionKey: string;
  title?: string | null;
  subtitle?: string | null;
  description?: string | null;
  layoutType?: string | null;
  settingsJson?: unknown;
  sortOrder: number;
  blocks: CmsBlock[];
};

export type CmsPage = {
  id: string;
  title: string;
  slug: string;
  pageKey: string;
  status: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoKeywords?: string | null;
  robotsTag?: string | null;
  canonicalUrl?: string | null;
  favicon?: string | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogImage?: string | null;
  twitterTitle?: string | null;
  twitterDescription?: string | null;
  twitterImage?: string | null;
  faqSchemaJson?: unknown;
  sections: CmsSection[];
};

export type CmsMenuItem = {
  id: string;
  menuId: string;
  parentId?: string | null;
  label: string;
  url: string;
  sortOrder: number;
  openInNewTab?: boolean;
  status?: string;
  translations?: CmsTranslationMap;
};

export type CmsMenu = {
  id: string;
  name: string;
  location: string;
  status: string;
  items: CmsMenuItem[];
};

export type CmsFooter = {
  id: string;
  title?: string | null;
  description?: string | null;
  logo?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  socialLinksJson?: unknown;
  newsletterEnabled?: boolean;
  status: string;
  translations?: CmsTranslationMap;
};

export function useCmsPage(pageKey: string) {
  return useQuery<CmsPage | null>({
    queryKey: ["cms-page", pageKey],
    queryFn: async () => {
      try {
        const r = await apiClient.get(`/cms/pages/key/${pageKey}`);
        return r.data.data ?? null;
      } catch {
        return null;
      }
    },
    staleTime: STALE.medium,
    enabled: !!pageKey,
  });
}

export function useCmsMenu(location: string) {
  return useQuery<CmsMenu | null>({
    queryKey: ["cms-menu", location],
    queryFn: async () => {
      try {
        const r = await apiClient.get(`/cms/menus/${location}`);
        return r.data.data ?? null;
      } catch {
        return null;
      }
    },
    staleTime: STALE.long,
  });
}

export function useCmsFooter() {
  return useQuery<CmsFooter | null>({
    queryKey: ["cms-footer"],
    queryFn: async () => {
      try {
        const r = await apiClient.get("/cms/footer");
        return r.data.data ?? null;
      } catch {
        return null;
      }
    },
    staleTime: STALE.long,
  });
}
