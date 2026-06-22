// Centralised event tracking — calls all enabled integrations from one place

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
    fbq: (...args: unknown[]) => void;
    clarity: (...args: unknown[]) => void;
    hj: (...args: unknown[]) => void;
    lintrk: (...args: unknown[]) => void;
    twq: (...args: unknown[]) => void;
    pintrk: (...args: unknown[]) => void;
    ttq: { track: (...args: unknown[]) => void };
    _hsq: unknown[];
  }
}

export type TrackEventPayload = {
  name: string;
  category?: string;
  properties?: Record<string, unknown>;
};

function safe<T extends (...args: unknown[]) => void>(fn: T | undefined, ...args: Parameters<T>) {
  if (typeof fn === "function") { try { fn(...args); } catch { /* silent */ } }
}

export function trackEvent({ name, category, properties = {} }: TrackEventPayload) {
  if (typeof window === "undefined") return;

  const payload = { event_category: category, ...properties };

  // Google Analytics 4
  safe(window.gtag, "event", name, payload);

  // Google Tag Manager (push to dataLayer)
  if (Array.isArray(window.dataLayer)) {
    window.dataLayer.push({ event: name, ...payload });
  }

  // Meta Pixel
  safe(window.fbq, "trackCustom", name, properties);

  // Microsoft Clarity
  safe(window.clarity, "event", name);

  // LinkedIn Insight
  if (typeof window.lintrk === "function") {
    safe(window.lintrk, "track", { conversion_id: properties.conversionId });
  }

  // HubSpot
  if (Array.isArray(window._hsq)) {
    window._hsq.push(["trackEvent", { id: name, value: properties.value }]);
  }
}

// Semantic event shortcuts

export function trackPageView(path: string) {
  trackEvent({ name: "PageView", category: "navigation", properties: { path } });
  safe(window.fbq, "track", "PageView");
}

export function trackViewProduct(productId: string, productTitle: string, categoryName?: string) {
  trackEvent({ name: "ViewContent", category: "product", properties: { productId, productTitle, categoryName } });
  safe(window.fbq, "track", "ViewContent", { content_ids: [productId], content_name: productTitle, content_category: categoryName });
}

export function trackAddToQuote(productId: string, variantId: string, quantity: number, value?: number) {
  trackEvent({ name: "AddToQuote", category: "ecommerce", properties: { productId, variantId, quantity, value } });
}

export function trackRequestQuote(productId?: string, itemCount?: number, value?: number) {
  trackEvent({ name: "Lead", category: "conversion", properties: { productId, itemCount, value } });
  safe(window.fbq, "track", "Lead", { value, currency: "INR" });
}

export function trackSubmitContact(formType: string) {
  trackEvent({ name: "Contact", category: "conversion", properties: { formType } });
  safe(window.fbq, "track", "Contact");
}

export function trackDownloadCatalogue(productId?: string, productTitle?: string) {
  trackEvent({ name: "DownloadCatalogue", category: "engagement", properties: { productId, productTitle } });
}
