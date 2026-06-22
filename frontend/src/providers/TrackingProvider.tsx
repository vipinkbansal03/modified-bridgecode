"use client";

import { createContext, useContext, useState, useEffect } from "react";
import Script from "next/script";
import { MessageCircle, X, Check } from "lucide-react";
import { useTrackingSettings, type TrackingSettings } from "@/hooks/api/useTrackingSettings";

// ─── Context ──────────────────────────────────────────────────────────────────

type TrackingContextValue = { settings: TrackingSettings | null; cookiesAccepted: boolean | null };
const TrackingContext = createContext<TrackingContextValue>({ settings: null, cookiesAccepted: null });
export const useTracking = () => useContext(TrackingContext);

// ─── Cookie consent state ─────────────────────────────────────────────────────

const COOKIE_KEY = "modortho_cookie_consent";

function getConsent(): boolean | null {
  if (typeof window === "undefined") return null;
  const v = localStorage.getItem(COOKIE_KEY);
  if (v === "accepted") return true;
  if (v === "rejected") return false;
  return null;
}

// ─── Main provider ────────────────────────────────────────────────────────────

export function TrackingProvider({ children }: { children: React.ReactNode }) {
  const { data: settings } = useTrackingSettings();
  const [consent, setConsent] = useState<boolean | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [scriptsReady, setScriptsReady] = useState(false);

  useEffect(() => {
    setConsent(getConsent());
    setScriptsReady(true);
  }, []);

  function accept() {
    localStorage.setItem(COOKIE_KEY, "accepted");
    setConsent(true);
    setBannerDismissed(true);
  }

  function reject() {
    localStorage.setItem(COOKIE_KEY, "rejected");
    setConsent(false);
    setBannerDismissed(true);
  }

  const analyticsEnabled = consent !== false;
  const s = settings;

  return (
    <TrackingContext.Provider value={{ settings: s ?? null, cookiesAccepted: consent }}>
      {children}

      {/* ── Tracking scripts (only when analytics not rejected) ── */}
      {scriptsReady && analyticsEnabled && s && (
        <>
          {/* Google Tag Manager */}
          {s.gtm.enabled && s.gtm.containerId && (
            <>
              <Script id="gtm" strategy="afterInteractive">{`
                (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});
                var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';
                j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
                })(window,document,'script','dataLayer','${s.gtm.containerId}');
              `}</Script>
              <noscript><iframe src={`https://www.googletagmanager.com/ns.html?id=${s.gtm.containerId}`} height="0" width="0" style={{ display: "none", visibility: "hidden" }} /></noscript>
            </>
          )}

          {/* Google Analytics 4 (standalone, not via GTM) */}
          {s.ga4.enabled && s.ga4.measurementId && !s.gtm.enabled && (
            <>
              <Script src={`https://www.googletagmanager.com/gtag/js?id=${s.ga4.measurementId}`} strategy="afterInteractive" />
              <Script id="ga4" strategy="afterInteractive">{`
                window.dataLayer=window.dataLayer||[];
                function gtag(){dataLayer.push(arguments);}
                gtag('js',new Date());
                gtag('config','${s.ga4.measurementId}',{page_path:window.location.pathname});
              `}</Script>
            </>
          )}

          {/* Microsoft Clarity */}
          {s.clarity.enabled && s.clarity.projectId && (
            <Script id="clarity" strategy="afterInteractive">{`
              (function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
              })(window,document,"clarity","script","${s.clarity.projectId}");
            `}</Script>
          )}

          {/* Meta Pixel */}
          {s.metaPixel.enabled && s.metaPixel.pixelId && (
            <Script id="meta-pixel" strategy="afterInteractive">{`
              !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
              n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
              document,'script','https://connect.facebook.net/en_US/fbevents.js');
              fbq('init','${s.metaPixel.pixelId}');fbq('track','PageView');
            `}</Script>
          )}

          {/* Hotjar */}
          {s.hotjar.enabled && s.hotjar.siteId && (
            <Script id="hotjar" strategy="afterInteractive">{`
              (function(h,o,t,j,a,r){h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
              h._hjSettings={hjid:${s.hotjar.siteId},hjsv:6};a=o.getElementsByTagName('head')[0];
              r=o.createElement('script');r.async=1;r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;
              a.appendChild(r)})(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');
            `}</Script>
          )}

          {/* LinkedIn Insight */}
          {s.linkedin.enabled && s.linkedin.partnerId && (
            <Script id="linkedin" strategy="afterInteractive">{`
              _linkedin_partner_id="${s.linkedin.partnerId}";
              window._linkedin_data_partner_ids=window._linkedin_data_partner_ids||[];
              window._linkedin_data_partner_ids.push(_linkedin_partner_id);
              (function(l){if(!l){window.lintrk=function(a,b){window.lintrk.q.push([a,b])};
              window.lintrk.q=[]}var s=document.getElementsByTagName("script")[0];
              var b=document.createElement("script");b.type="text/javascript";b.async=true;
              b.src="https://snap.licdn.com/li.lms-analytics/insight.min.js";
              s.parentNode.insertBefore(b,s)})(window.lintrk);
            `}</Script>
          )}

          {/* Twitter/X Pixel */}
          {s.twitter.enabled && s.twitter.pixelId && (
            <Script id="twitter-pixel" strategy="afterInteractive">{`
              !function(e,t,n,s,u,a){e.twq||(s=e.twq=function(){s.exe?s.exe.apply(s,arguments):s.queue.push(arguments);},
              s.version='1.1',s.queue=[],u=t.createElement(n),u.async=!0,u.src='https://static.ads-twitter.com/uwt.js',
              a=t.getElementsByTagName(n)[0],a.parentNode.insertBefore(u,a))}(window,document,'script');
              twq('config','${s.twitter.pixelId}');
            `}</Script>
          )}

          {/* Pinterest */}
          {s.pinterest.enabled && s.pinterest.tagId && (
            <Script id="pinterest" strategy="afterInteractive">{`
              !function(e){if(!window.pintrk){window.pintrk=function(){window.pintrk.queue.push(Array.prototype.slice.call(arguments))};
              var n=window.pintrk;n.queue=[],n.version="3.0";var t=document.createElement("script");
              t.async=!0,t.src=e;var r=document.getElementsByTagName("script")[0];
              r.parentNode.insertBefore(t,r)}}("https://s.pinimg.com/ct/core.js");
              pintrk('load','${s.pinterest.tagId}');pintrk('page');
            `}</Script>
          )}

          {/* TikTok */}
          {s.tiktok.enabled && s.tiktok.pixelId && (
            <Script id="tiktok" strategy="afterInteractive">{`
              !function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];
              ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],
              ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
              for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
              ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},
              ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;
              ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script");
              n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};
              ttq.load('${s.tiktok.pixelId}');ttq.page();}(window,document,'ttq');
            `}</Script>
          )}

          {/* HubSpot */}
          {s.hubspot.enabled && s.hubspot.trackingCode && (
            <Script src={`//js.hs-scripts.com/${s.hubspot.trackingCode}.js`} strategy="lazyOnload" />
          )}

          {/* Verification meta tags rendered via inline script to head */}
          {s.verification.google && (
            <Script id="verify-google" strategy="afterInteractive">{`
              var m=document.createElement('meta');m.name='google-site-verification';
              m.content='${s.verification.google}';document.head.appendChild(m);
            `}</Script>
          )}
          {s.verification.bing && (
            <Script id="verify-bing" strategy="afterInteractive">{`
              var m=document.createElement('meta');m.name='msvalidate.01';
              m.content='${s.verification.bing}';document.head.appendChild(m);
            `}</Script>
          )}
          {s.verification.facebookDomain && (
            <Script id="verify-fb" strategy="afterInteractive">{`
              var m=document.createElement('meta');m.name='facebook-domain-verification';
              m.content='${s.verification.facebookDomain}';document.head.appendChild(m);
            `}</Script>
          )}

          {/* Custom header scripts */}
          {s.scripts.header && (
            <Script id="custom-header" strategy="afterInteractive">{s.scripts.header}</Script>
          )}

          {/* Custom footer scripts */}
          {s.scripts.footer && (
            <Script id="custom-footer" strategy="lazyOnload">{s.scripts.footer}</Script>
          )}
        </>
      )}

      {/* ── Cookie consent banner ── */}
      {scriptsReady && s?.cookies.enabled && consent === null && !bannerDismissed && (
        <CookieBanner
          title={s.cookies.bannerTitle}
          description={s.cookies.bannerDescription}
          privacyUrl={s.cookies.privacyPolicyUrl}
          onAccept={accept}
          onReject={reject}
        />
      )}

      {/* ── WhatsApp floating button ── */}
      {s?.whatsapp.floatingButtonEnabled && s.whatsapp.number && (
        <WhatsAppButton number={s.whatsapp.number} message={s.whatsapp.defaultMessage ?? ""} />
      )}
    </TrackingContext.Provider>
  );
}

// ─── Cookie consent banner ────────────────────────────────────────────────────

function CookieBanner({ title, description, privacyUrl, onAccept, onReject }: {
  title: string; description: string; privacyUrl: string; onAccept: () => void; onReject: () => void;
}) {
  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 sm:left-auto sm:right-6 sm:max-w-sm">
      <div className="rounded-2xl border border-line bg-white p-5 shadow-[0_24px_60px_rgba(0,0,0,0.14)]">
        <p className="mb-1 text-[14px] font-semibold text-ink">{title}</p>
        <p className="mb-3 text-[12.5px] leading-relaxed text-steel-2">{description}{" "}
          <a href={privacyUrl} className="underline text-brand hover:opacity-75">Privacy Policy</a>
        </p>
        <div className="flex gap-2">
          <button onClick={onAccept} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand py-2 text-[12.5px] font-semibold text-white hover:bg-brand/90 transition-colors">
            <Check size={12} />Accept
          </button>
          <button onClick={onReject} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-line py-2 text-[12.5px] font-medium text-steel hover:bg-offwhite transition-colors">
            <X size={12} />Reject
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── WhatsApp floating button ─────────────────────────────────────────────────

function WhatsAppButton({ number, message }: { number: string; message: string }) {
  const href = `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp"
      className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] shadow-[0_8px_24px_rgba(37,211,102,0.4)] transition hover:scale-105"
    >
      <MessageCircle size={26} className="text-white" fill="white" />
    </a>
  );
}
