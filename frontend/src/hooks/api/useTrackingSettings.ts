import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";

export type TrackingSettings = {
  ga4: { enabled: boolean; measurementId: string | null };
  gtm: { enabled: boolean; containerId: string | null };
  clarity: { enabled: boolean; projectId: string | null };
  hotjar: { enabled: boolean; siteId: string | null };
  hubspot: { enabled: boolean; trackingCode: string | null };
  metaPixel: { enabled: boolean; pixelId: string | null };
  linkedin: { enabled: boolean; partnerId: string | null };
  twitter: { enabled: boolean; pixelId: string | null };
  pinterest: { enabled: boolean; tagId: string | null };
  tiktok: { enabled: boolean; pixelId: string | null };
  verification: { google: string | null; bing: string | null; pinterest: string | null; facebookDomain: string | null; custom: string | null };
  scripts: { header: string | null; footer: string | null };
  cookies: { enabled: boolean; bannerTitle: string; bannerDescription: string; privacyPolicyUrl: string };
  whatsapp: { number: string | null; defaultMessage: string | null; floatingButtonEnabled: boolean };
  social: { facebook: string | null; instagram: string | null; linkedin: string | null; youtube: string | null; twitter: string | null; pinterest: string | null };
  seo: { defaultTitle: string; defaultDescription: string; defaultKeywords: string | null; ogTitle: string | null; ogDescription: string | null; ogImage: string | null; twitterImage: string | null; canonicalDomain: string | null };
  general: { siteName: string; siteUrl: string | null; logoUrl: string | null; logoAlt?: string | null; mobileLogoUrl?: string | null; faviconUrl: string | null };
};

let cachedSettings: TrackingSettings | null = null;

export async function fetchTrackingSettings(): Promise<TrackingSettings | null> {
  if (cachedSettings) return cachedSettings;
  try {
    const res = await fetch("/api/settings/public/tracking", { next: { revalidate: 0 } } as RequestInit);
    if (!res.ok) return null;
    const json = await res.json();
    cachedSettings = json.data;
    return cachedSettings;
  } catch {
    return null;
  }
}

export function useTrackingSettings(countryCode?: string) {
  return useQuery<TrackingSettings | null>({
    queryKey: ["tracking-settings", countryCode],
    queryFn: async () => {
      try {
        const r = await apiClient.get("/settings/public/tracking", { params: { country: countryCode } });
        const data = r.data.data ?? null;
        return data;
      } catch {
        return null;
      }
    },
    staleTime: 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}
