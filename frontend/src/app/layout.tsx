import type { Metadata } from "next";
import { Inter, Jost } from "next/font/google";
import { AppShell } from "@/components/layout/AppShell";
import { ReactQueryProvider } from "@/lib/reactQueryProvider";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { QuoteCartProvider } from "@/contexts/QuoteCartContext";
import { CustomerAuthProvider } from "@/contexts/CustomerAuthContext";
import { CartProvider } from "@/contexts/CartContext";
import { TrackingProvider } from "@/providers/TrackingProvider";
import { ToastProvider } from "@/components/ui/ToastProvider";
import { DeliveryAddressProvider } from "@/contexts/DeliveryAddressContext";
import { QuoteCartUIProvider } from "@/contexts/QuoteCartUIContext";
import { buildCmsMetadata } from "@/lib/seo";
import seoData from "@/data/seo.json";
import "react-toastify/dist/ReactToastify.css";
import "@/styles/globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-inter",
});

const jost = Jost({
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
  variable: "--font-jost",
});

export async function generateMetadata(): Promise<Metadata> {
  return buildCmsMetadata("home", seoData.home, "/");
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jost.variable}`} data-scroll-behavior="smooth">
      <body className="font-sans antialiased">
        <ReactQueryProvider>
          <LanguageProvider>
            <CurrencyProvider>
              <DeliveryAddressProvider>
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
              </DeliveryAddressProvider>
            </CurrencyProvider>
          </LanguageProvider>
        </ReactQueryProvider>
      </body>
    </html>
  );
}
