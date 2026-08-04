"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

const CartDrawer = dynamic(
  () => import("@/components/cart/CartDrawer").then((m) => m.CartDrawer),
  { ssr: false }
);
const QuoteCartMini = dynamic(
  () => import("@/components/quote/QuoteCartMini").then((m) => m.QuoteCartMini),
  { ssr: false }
);
const NewsletterModal = dynamic(
  () => import("@/components/newsletter/NewsletterModal").then((m) => m.NewsletterModal),
  { ssr: false }
);

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const isAdminRoute = pathname.startsWith("/admin");
  const isAuthRoute = pathname === "/login" || pathname === "/register";

  if (isAdminRoute || isAuthRoute) {
    return <>{children}</>;
  }

  return (
    <>
      <Header />
      {children}
      <Footer />
      <CartDrawer />
      <QuoteCartMini />
      <NewsletterModal />
    </>
  );
}
