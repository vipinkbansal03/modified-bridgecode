import { cookies } from "next/headers";
import type { CmsPage } from "@/hooks/api/useCmsContent";

async function getLanguageCookie(): Promise<string | undefined> {
  try {
    const cookieStore = await cookies();
    return cookieStore?.get?.("language")?.value;
  } catch {
    return undefined;
  }
}

export async function fetchCmsPageByKey(pageKey: string): Promise<CmsPage | null> {
  try {
    const apiBase = process.env.API_BASE_URL ?? "http://localhost:4000";
    const language = await getLanguageCookie();
    const query = language ? `?lang=${encodeURIComponent(language)}` : "";
    const res = await fetch(`${apiBase}/api/cms/pages/key/${pageKey}${query}`, {
      cache: "no-store",
      next: { revalidate: 0 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data ?? null;
  } catch {
    return null;
  }
}

export async function fetchCmsPageBySlug(slug: string): Promise<CmsPage | null> {
  try {
    const apiBase = process.env.API_BASE_URL ?? "http://localhost:4000";
    const language = await getLanguageCookie();
    const query = language ? `?lang=${encodeURIComponent(language)}` : "";
    const res = await fetch(`${apiBase}/api/cms/pages/${encodeURIComponent(slug)}${query}`, {
      cache: "no-store",
      next: { revalidate: 0 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data ?? null;
  } catch {
    return null;
  }
}
