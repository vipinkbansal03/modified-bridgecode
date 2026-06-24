"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, Search, User, ShoppingCart, Menu, X } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { MegaMenu } from "@/components/layout/MegaMenu";
import { MobileMenu } from "@/components/layout/MobileMenu";
import { CurrencySwitcher } from "@/components/ui/CurrencySwitcher";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import { SearchOverlay } from "@/components/ui/SearchOverlay";
import { useQuoteCart } from "@/contexts/QuoteCartContext";
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
  const [searchOpen, setSearchOpen] = useState(false);
  const { totals } = useQuoteCart();
  const { t } = useStaticTranslations();
  const label = (value: string) => navLabelKeys[value] ? t(navLabelKeys[value]) : value;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 bg-white transition-shadow duration-300",
        scrolled && "shadow-[0_1px_0_rgba(0,0,0,0.03),0_12px_28px_-8px_rgba(0,0,0,0.08)]"
      )}
    >
      <div className="border-b border-line">
        <div className="mx-auto flex h-20 max-w-wrap items-center justify-between px-5 sm:px-10">
          <Link href="/">
            <Logo />
          </Link>

          <ul className="hidden items-center gap-9 text-[15px] font-medium text-ink lg:flex">
            <li
              className="relative"
              onMouseEnter={() => setMegaOpen(true)}
              onMouseLeave={() => setMegaOpen(false)}
            >
              <Link href="/products" className="flex items-center gap-1.5 py-7">
                {t("ui.nav.products")}
                <ChevronDown size={11} className="opacity-60" />
              </Link>
              <MegaMenu open={megaOpen} groups={nav.productMegaMenu} />
            </li>
            <li
              className="relative"
              onMouseEnter={() => setCapsOpen(true)}
              onMouseLeave={() => setCapsOpen(false)}
            >
              <span className="flex cursor-default items-center gap-1.5 py-7">
                {t("ui.nav.capabilities")}
                <ChevronDown size={11} className="opacity-60" />
              </span>
              {capsOpen && (
                <div className="absolute left-0 top-full z-50 w-[260px] rounded-md border border-line bg-white p-3 shadow-[0_16px_32px_rgba(0,0,0,0.07)]">
                  {nav.capabilitiesMenu.map((link) => (
                    <Link key={link.label} href={link.href} className="block rounded-md px-3 py-2.5 text-[14.5px] text-ink hover:bg-grey hover:text-brand">
                      {label(link.label)}
                    </Link>
                  ))}
                </div>
              )}
            </li>
            {nav.primary.slice(1).map((link) => (
              <li key={link.label}>
                <Link href={link.href} className="block py-7 hover:text-brand">
                  {label(link.label)}
                </Link>
              </li>
            ))}
          </ul>

          <div className="hidden items-center gap-5 lg:flex">
            <LanguageSwitcher />
            <CurrencySwitcher />
            <button aria-label={t("ui.nav.search")} className="text-ink hover:text-brand" onClick={() => setSearchOpen(true)}>
              <Search size={18} />
            </button>
            <button aria-label={t("ui.nav.account")} className="text-ink">
              <User size={18} />
            </button>
            <button aria-label={t("ui.nav.quoteCart")} className="relative text-ink hover:text-brand">
              <ShoppingCart size={18} />
              {totals.itemCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#E31E24] text-[9px] font-bold text-white">
                  {totals.itemCount}
                </span>
              )}
            </button>
            <Link
              href={nav.ctaHref}
              className="rounded-pill border border-ink px-4.5 py-2.5 text-[14.5px] font-semibold text-ink transition-colors hover:bg-ink hover:text-white"
            >
              {label(nav.ctaLabel)}
            </Link>
          </div>

          <button
            aria-label={t("ui.nav.menu")}
            className="text-ink lg:hidden"
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      <div className="hidden border-b border-line bg-offwhite lg:block">
        <div className="mx-auto flex h-[46px] max-w-wrap items-center gap-7 overflow-x-auto px-5 sm:px-10">
          {nav.subNav.map((link) => (
            <Link key={link.label} href={link.href} className="whitespace-nowrap text-[13.5px] text-steel hover:text-brand">
              {label(link.label)}
            </Link>
          ))}
        </div>
      </div>

      <MobileMenu
        open={mobileOpen}
        links={[nav.primary[0], ...nav.capabilitiesMenu, ...nav.primary.slice(1)]}
        ctaLabel={label(nav.ctaLabel)}
        ctaHref={nav.ctaHref}
        onLinkClick={() => setMobileOpen(false)}
      />

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
}
