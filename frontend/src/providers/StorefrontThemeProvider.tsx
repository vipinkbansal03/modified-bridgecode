"use client";

import { useEffect } from "react";
import { useTrackingSettings } from "@/hooks/api/useTrackingSettings";

const FONT_FAMILIES = new Set(["Inter", "Manrope", "DM Sans", "Source Sans 3", "Roboto"]);

function safeFont(font: string | undefined, fallback: string) {
  return font && FONT_FAMILIES.has(font) ? font : fallback;
}

export function StorefrontThemeProvider({ children }: { children: React.ReactNode }) {
  const { data: settings } = useTrackingSettings();
  const theme = settings?.theme;

  useEffect(() => {
    const root = document.documentElement;
    const headingFont = safeFont(theme?.headingFont, "Manrope");
    const bodyFont = safeFont(theme?.bodyFont, "Inter");
    const fontHref = `https://fonts.googleapis.com/css2?family=${headingFont.replace(/ /g, "+")}:wght@400;500;600;700;800&family=${bodyFont.replace(/ /g, "+")}:wght@400;500;600;700&display=swap`;
    let fontLink = document.querySelector<HTMLLinkElement>('link[data-storefront-theme-fonts]');

    if (!fontLink) {
      fontLink = document.createElement("link");
      fontLink.rel = "stylesheet";
      fontLink.dataset.storefrontThemeFonts = "true";
      document.head.appendChild(fontLink);
    }
    fontLink.href = fontHref;

    const tokens = {
      "--color-primary": theme?.primary ?? "#0F6B78",
      "--color-accent": theme?.accent ?? "#E45B3F",
      "--color-surface": theme?.surface ?? "#F7FAFB",
      "--color-text-primary": theme?.textPrimary ?? "#102A33",
      "--color-text-secondary": theme?.textSecondary ?? "#52656D",
      "--color-border": theme?.border ?? "#D8E2E5",
      "--font-heading": `"${headingFont}", var(--font-poppins), sans-serif`,
      "--font-body": `"${bodyFont}", var(--font-poppins), sans-serif`,
      "--red": theme?.primary ?? "#0F6B78",
      "--red-deep": theme?.accent ?? "#E45B3F",
      "--ink": theme?.textPrimary ?? "#102A33",
      "--steel": theme?.textSecondary ?? "#52656D",
      "--line": theme?.border ?? "#D8E2E5",
      "--offwhite": theme?.surface ?? "#F7FAFB",
    };

    Object.entries(tokens).forEach(([key, value]) => root.style.setProperty(key, value));
  }, [theme]);

  return <>{children}</>;
}
