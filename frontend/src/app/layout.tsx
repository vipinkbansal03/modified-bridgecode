import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { ReactQueryProvider } from "@/lib/reactQueryProvider";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { QuoteCartProvider } from "@/contexts/QuoteCartContext";
import { buildMetadata } from "@/lib/seo";
import seoData from "@/data/seo.json";
import "@/styles/globals.css";

export const metadata: Metadata = buildMetadata(seoData.home, "/");

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans text-ink antialiased">
        <ReactQueryProvider>
          <CurrencyProvider>
            <QuoteCartProvider>
              <AppShell>{children}</AppShell>
            </QuoteCartProvider>
          </CurrencyProvider>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
