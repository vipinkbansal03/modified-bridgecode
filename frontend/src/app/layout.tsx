import type { Metadata } from "next";
import { AppShell } from "@/components/layout/AppShell";
import { ReactQueryProvider } from "@/lib/reactQueryProvider";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { QuoteCartProvider } from "@/contexts/QuoteCartContext";
import { CustomerAuthProvider } from "@/contexts/CustomerAuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { TrackingProvider } from "@/providers/TrackingProvider";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { QuoteCartUIProvider } from "@/contexts/QuoteCartUIContext";
import { buildCmsMetadata } from "@/lib/seo";
import seoData from "@/data/seo.json";
import "react-toastify/dist/ReactToastify.css";
import "@/styles/globals.css";

export async function generateMetadata(): Promise<Metadata> {
  return buildCmsMetadata("home", seoData.home, "/");
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans text-ink antialiased">
        <ReactQueryProvider>
          <LanguageProvider>
            <CurrencyProvider>
              <QuoteCartProvider>
                <QuoteCartUIProvider>
                  <CustomerAuthProvider>
                    <CartProvider>
                      <TrackingProvider>
                        <ToastProvider>
                          <AppShell>{children}</AppShell>
                        </ToastProvider>
                      </TrackingProvider>
                    </CartProvider>
                  </CustomerAuthProvider>
                </QuoteCartUIProvider>
              </QuoteCartProvider>
            </CurrencyProvider>
          </LanguageProvider>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
