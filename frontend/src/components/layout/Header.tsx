"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, User, ShoppingCart, Menu, X } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { MegaMenu } from "@/components/layout/MegaMenu";
import { MobileMenu } from "@/components/layout/MobileMenu";
import { CurrencySwitcher } from "@/components/ui/CurrencySwitcher";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { HeaderSearch } from "@/components/ui/HeaderSearch";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { useCart } from "@/contexts/CartContext";
import { useStaticTranslations } from "@/hooks/api/useStaticTranslations";
import navigation from "@/data/navigation.json";
import { cn } from "@/utils/cn";
import type { NavigationData } from "@/types/common.types";
import type { StaticMessageKey } from "@/i18n/staticMessages";

const nav = navigation as NavigationData;
const navLabelKeys: Record<string, StaticMessageKey> = {
  Products: "ui.nav.products",
  "Quality Certifications": "ui.nav.qualityCertifications",
  "Contact Us": "ui.nav.contactUs",
  "Design & Engineering": "ui.nav.designEngineering",
  "Manufacturing Services": "ui.nav.manufacturingServices",
  "OEM Services": "ui.nav.oemServices",
  "Custom Packaging": "ui.nav.customPackaging",
  "Become a Dealer": "ui.nav.becomeDealer",
  "Quick Order": "ui.nav.quickOrder",
};

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [capsOpen, setCapsOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const { totals, openCart } = useCart();
  const { currentCustomer, logout } = useCustomerAuth();
  const { t } = useStaticTranslations();
  const label = (value: string) => navLabelKeys[value] ? t(navLabelKeys[value]) : value;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const shouldLockScroll = megaOpen || capsOpen || mobileOpen || accountOpen;
    if (!shouldLockScroll) return;

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, [accountOpen, capsOpen, megaOpen, mobileOpen]);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 bg-white transition-shadow duration-300",
        scrolled &&
          "shadow-[0_1px_0_rgba(0,0,0,0.03),0_12px_28px_-8px_rgba(0,0,0,0.08)]",
      )}
    >
      <div className="border-b border-line">
        <div className="mx-auto flex h-20 max-w-[1480px] items-center justify-between gap-5 px-5 sm:px-8 xl:px-10">
          <Link href="/" className="shrink-0">
            <Logo />
          </Link>

          <ul className="hidden shrink-0 items-center gap-5 text-[15px] font-medium text-ink xl:flex 2xl:gap-7">
            <li
              className="relative shrink-0"
              onMouseEnter={() => setMegaOpen(true)}
              onMouseLeave={() => setMegaOpen(false)}
            >
              <Link href="/products" className="flex items-center gap-1.5 whitespace-nowrap py-7">
                {t("ui.nav.products")}
                <ChevronDown size={11} className="opacity-60" />
              </Link>
              <MegaMenu open={megaOpen} groups={nav.productMegaMenu} />
            </li>
            <li
              className="relative shrink-0"
              onMouseEnter={() => setCapsOpen(true)}
              onMouseLeave={() => setCapsOpen(false)}
            >
              <span className="flex cursor-default items-center gap-1.5 whitespace-nowrap py-7">
                {t("ui.nav.capabilities")}
                <ChevronDown size={11} className="opacity-60" />
              </span>
              {capsOpen && (
                <div className="absolute left-0 top-full z-50 w-[260px] rounded-md border border-line bg-white p-3 shadow-[0_16px_32px_rgba(0,0,0,0.07)]">
                  {nav.capabilitiesMenu.map((link) => (
                    <Link
                      key={link.label}
                      href={link.href}
                      className="block rounded-md px-3 py-2.5 text-[14.5px] text-ink hover:bg-grey hover:text-brand"
                    >
                      {label(link.label)}
                    </Link>
                  ))}
                </div>
              )}
            </li>
            {nav.primary.slice(1).map((link) => (
              <li key={link.label} className="shrink-0">
                <Link href={link.href} className="block whitespace-nowrap py-7 hover:text-brand">
                  {label(link.label)}
                </Link>
              </li>
            ))}
          </ul>

          <div className="hidden min-w-0 items-center gap-3 xl:flex xl:gap-3.5">
            <HeaderSearch />
            <LanguageSwitcher />
            <CurrencySwitcher />
            <div className="relative">
              {currentCustomer ? (
                <>
                  <button
                    aria-label={t("ui.nav.account")}
                    className="flex items-center gap-1.5 text-ink hover:text-brand"
                    onClick={() => setAccountOpen((value) => !value)}
                  >
                    <User size={18} />
                    <ChevronDown size={11} className={cn("opacity-60 transition-transform", accountOpen && "rotate-180")} />
                  </button>
                  {accountOpen && (
                    <div className="absolute right-0 top-full z-50 mt-4 w-[230px] rounded-md border border-line bg-white p-3 shadow-[0_16px_32px_rgba(0,0,0,0.07)]">
                      <div className="border-b border-line pb-3">
                        <p className="truncate text-[13.5px] font-semibold text-ink">
                          {currentCustomer.firstName} {currentCustomer.lastName}
                        </p>
                        <p className="mt-0.5 truncate text-[12px] text-steel">{currentCustomer.email}</p>
                      </div>
                      <Link
                        href="/account"
                        onClick={() => setAccountOpen(false)}
                        className="mt-2 block rounded-md px-3 py-2 text-[13.5px] text-ink hover:bg-grey hover:text-brand"
                      >
                        My Account
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setAccountOpen(false);
                          logout();
                        }}
                        className="mt-2 w-full rounded-md px-3 py-2 text-left text-[13.5px] text-ink hover:bg-grey hover:text-brand"
                      >
                        Log out
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <Link aria-label={t("ui.nav.account")} href="/login" className="text-ink hover:text-brand">
                  <User size={18} />
                </Link>
              )}
            </div>
            <button
              aria-label="Open cart"
              className="relative text-ink hover:text-brand"
              onClick={openCart}
            >
              <ShoppingCart size={18} />
              {totals.itemCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#E31E24] text-[9px] font-bold text-white">
                  {totals.itemCount}
                </span>
              )}
            </button>
            <Link
              href={nav.ctaHref}
              className="shrink-0 whitespace-nowrap rounded-pill border border-ink px-4.5 py-2.5 text-[14.5px] font-semibold text-ink transition-colors hover:bg-ink hover:text-white"
            >
              {label(nav.ctaLabel)}
            </Link>
          </div>

          <button
            aria-label={t("ui.nav.menu")}
            className="text-ink xl:hidden"
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <button
          aria-label="Close menu overlay"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 top-20 z-40 bg-black/45 backdrop-blur-[2px] xl:hidden"
        />
      )}

      <MobileMenu
        open={mobileOpen}
        links={[
          nav.primary[0],
          ...nav.capabilitiesMenu,
          ...nav.primary.slice(1),
        ]}
        ctaLabel={label(nav.ctaLabel)}
        ctaHref={nav.ctaHref}
        isLoggedIn={Boolean(currentCustomer)}
        cartCount={totals.itemCount}
        onLinkClick={() => setMobileOpen(false)}
        onCartClick={openCart}
      />
    </header>
  );
}
