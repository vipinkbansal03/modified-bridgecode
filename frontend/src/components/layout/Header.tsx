"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { DeliveryAddressButton } from "@/components/ui/delivery/DeliveryAddressButton";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ShoppingCart, Heart, Menu, X, MapPin, FileText, Truck, Award, PhoneCall, Clock, Mail, Download } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { MegaMenu } from "@/components/layout/MegaMenu";
import { MobileMenu } from "@/components/layout/MobileMenu";
import { HeaderSearch } from "@/components/ui/HeaderSearch";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { useCart } from "@/contexts/CartContext";
import { useWishlistCount, useCategories, useProducts } from "@/hooks/api";
import { useTrackingSettings } from "@/hooks/api/useTrackingSettings";
import { useCmsMenu } from "@/hooks/api/useCmsContent";
import { useStaticTranslations } from "@/hooks/api/useStaticTranslations";
import navigation from "@/data/navigation.json";
import { cmsMenuToLinks, cmsMenuToMegaGroups } from "@/lib/cmsNavigation";
import { cn } from "@/utils/cn";
import type { NavigationData } from "@/types/common.types";
import type { StaticMessageKey } from "@/i18n/staticMessages";
import { LocaleSwitcher } from "@/components/ui/LocaleSwitcher";
import { NotificationBell } from "@/components/ui/NotificationBell";
import { HAS_LIVE_API } from "@/lib/apiClient";

const nav = navigation as NavigationData;
const navLabelKeys: Record<string, StaticMessageKey> = {
  Home: "ui.nav.home",
  Products: "ui.nav.products",
  "All Products": "ui.nav.products",
  "Quality Certifications": "ui.nav.qualityCertifications",
  "Contact Us": "ui.nav.contactUs",
  "Design & Engineering": "ui.nav.designEngineering",
  "Manufacturing Services": "ui.nav.manufacturingServices",
  "OEM Services": "ui.nav.oemServices",
  "Custom Packaging": "ui.nav.customPackaging",
  "Become a Dealer": "ui.nav.becomeDealer",
  "Quick Order": "ui.nav.quickOrder",
};

const clinicalWorkflowLinks = [
  { label: "Brackets", href: "/products?search=bracket" },
  { label: "Archwires", href: "/products?search=archwire" },
  { label: "Elastomerics", href: "/products?search=elastomeric" },
  { label: "Buccal Tubes", href: "/products?search=buccal%20tube" },
  { label: "Clinical Instruments", href: "/products?search=instrument" },
];

export function Header() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [capsOpen, setCapsOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);
  const { totals, openCart } = useCart();
  const { currentCustomer, logout } = useCustomerAuth();
  const { data: wishlistCount = 0 } = useWishlistCount();
  const { data: trackingSettings, isLoading: trackingLoading } = useTrackingSettings();
  const logoUrl = trackingSettings?.general?.logoUrl ?? null;
  const mobileLogoUrl = trackingSettings?.general?.mobileLogoUrl ?? null;
  const logoAlt = trackingSettings?.general?.logoAlt ?? trackingSettings?.general?.siteName ?? "Modern Orthodontics";
  const { t } = useStaticTranslations();
  const label = (value: string) =>
    navLabelKeys[value] ? t(navLabelKeys[value]) : value;
  const { data: cmsPrimaryMenu } = useCmsMenu("header-primary");
  const { data: cmsCapabilitiesMenu } = useCmsMenu("header-capabilities");
  const { data: cmsProductsMegaMenu } = useCmsMenu("header-products-mega");
  const { data: cmsCtaMenu } = useCmsMenu("header-cta");

  const { data: categories = [] } = useCategories();
  const { data: productsRes } = useProducts({ limit: 500 });
  const products = productsRes?.data ?? [];

  const dynamicMegaMenu = useMemo(() => {
    if (!categories.length) return [];
    return categories
      .map((cat) => {
        const catProducts = products
          .filter((p) => p.category?.slug === cat.slug || p.category?.name === cat.name)
          .slice()
          .sort((a, b) => a.title.localeCompare(b.title));
        return {
          label: cat.name || "Category",
          href: `/products?category=${cat.slug}`,
          children: catProducts.map((p) => ({
            label: p.title,
            href: `/products/${p.slug}`,
          })),
        };
      })
      .filter((group) => group.children.length > 0);
  }, [categories, products]);

  const primaryLinks = cmsMenuToLinks(cmsPrimaryMenu);
  const capabilitiesLinks = cmsMenuToLinks(cmsCapabilitiesMenu);
  const productMegaGroups = cmsMenuToMegaGroups(cmsProductsMegaMenu);
  const storefrontProductsMegaMenu = useMemo(() => {
    if (!cmsProductsMegaMenu || cmsProductsMegaMenu.status === "INACTIVE" || !cmsProductsMegaMenu.items || cmsProductsMegaMenu.items.length === 0) {
      return [];
    }
    return productMegaGroups;
  }, [cmsProductsMegaMenu, productMegaGroups]);
  const ctaLink = cmsMenuToLinks(cmsCtaMenu)[0];
  const hasCmsPrimary = primaryLinks.length > 0;
  const hasCmsCapabilities = capabilitiesLinks.length > 0;
  const primaryNav = hasCmsPrimary ? primaryLinks : nav.primary.slice(1);
  const capabilitiesNav = hasCmsCapabilities
    ? capabilitiesLinks
    : nav.capabilitiesMenu;
  const productsMegaNav = storefrontProductsMegaMenu;
  const ctaLabel = ctaLink?.label || label(nav.ctaLabel);
  const ctaHref = ctaLink?.href || nav.ctaHref;
  const mobileLinks = [
    { label: t("ui.nav.home"), href: "/" },
    { label: t("ui.nav.products"), href: "/products" },
    ...capabilitiesNav,
    ...primaryNav,
  ];

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) {
        setAccountOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const shouldLockScroll = mobileOpen;
    if (!shouldLockScroll) return;

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;

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
      {/* Top Highlights Ribbon Bar */}
      {trackingSettings?.highlights?.barEnabled !== false && (
        <div className="hidden xl:block bg-[#F8F9FA] text-[#4B5563] text-[12px] font-medium border-b border-[#E5E7EB]">
          <div className="mx-auto flex h-8 items-center justify-between px-4 sm:px-8 xl:px-10">
            {/* Left: Contact Info & Delivery Guarantee */}
            <div className="flex items-center gap-3.5">
              {trackingSettings?.highlights?.contactEnabled !== false && (
                <>
                  <a
                    href={`tel:${(trackingSettings?.highlights?.contactPhone || "1800 890 8022").replace(/\s+/g, "")}`}
                    className="flex items-center gap-1.5 hover:text-[#E31E24] transition-colors"
                  >
                    <PhoneCall size={12.5} className="text-[#E31E24] stroke-[1.75]" />
                    <span>{trackingSettings?.highlights?.contactPhone || "1800 890 8022"}</span>
                  </a>

                  {Boolean(trackingSettings?.highlights?.contactEmail) && (
                    <>
                      <span className="text-[#D1D5DB]">-</span>
                      <a
                        href={`mailto:${trackingSettings?.highlights?.contactEmail}`}
                        className="flex items-center gap-1.5 hover:text-[#E31E24] transition-colors"
                      >
                        <Mail size={12.5} className="text-[#E31E24] stroke-[1.75]" />
                        <span>{trackingSettings?.highlights?.contactEmail}</span>
                      </a>
                    </>
                  )}
                </>
              )}

              {trackingSettings?.highlights?.deliveryEnabled !== false && (
                <>
                  <span className="text-[#D1D5DB]">-</span>
                  <div className="flex items-center gap-1.5">
                    <Clock size={12.5} className="text-[#E31E24] stroke-[1.75]" />
                    <span>{trackingSettings?.highlights?.deliveryDesc || "Max 8 Days, Min 4 Days"}</span>
                  </div>
                </>
              )}
            </div>

            {/* Right: Free Shipping, Certifications & Catalogue */}
            <div className="flex items-center gap-3.5">
              {trackingSettings?.highlights?.freeShippingEnabled !== false && (
                <Link
                  href="/policies/shipping-policy"
                  className="flex items-center gap-1.5 hover:text-[#E31E24] transition-colors"
                >
                  <Truck size={13} className="text-[#E31E24] stroke-[1.75]" />
                  <span>
                    {trackingSettings?.highlights?.freeShippingTitle || "Free Shipping"} {trackingSettings?.highlights?.freeShippingDesc || "Above INR 3000"}
                  </span>
                </Link>
              )}

              {trackingSettings?.highlights?.certificationsEnabled !== false && (
                <>
                  <span className="text-[#D1D5DB]">|</span>
                  <Link
                    href="/quality-certifications"
                    className="flex items-center gap-1.5 hover:text-[#E31E24] transition-colors"
                  >
                    <Award size={13} className="text-[#E31E24] stroke-[1.75]" />
                    <span>{trackingSettings?.highlights?.certificationsBadges || "ISO, CE, FDA"}</span>
                  </Link>
                </>
              )}

              {trackingSettings?.highlights?.catalogueEnabled !== false &&
                Boolean(trackingSettings?.highlights?.cataloguePdfUrl) && (
                  <>
                    <span className="text-[#D1D5DB]">|</span>
                    <a
                      href={trackingSettings!.highlights!.cataloguePdfUrl!}
                      target="_blank"
                      rel="noopener noreferrer"
                      download="Modern_Orthodontics_Product_Catalogue.pdf"
                      className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50/80 px-2.5 py-0.5 text-[11.5px] font-semibold text-[#E31E24] hover:bg-[#E31E24] hover:text-white transition-all shadow-2xs"
                    >
                      <Download size={11.5} />
                      <span>{trackingSettings?.highlights?.catalogueTitle || "Product Catalogue"}</span>
                    </a>
                  </>
                )}
            </div>
          </div>
        </div>
      )}

      <div className="border-b border-line">
        <div className="mx-auto px-4 sm:px-8 xl:px-10">
          {/* Top Header */}
          <div className="hidden h-20 items-center gap-6 xl:flex">
            {/* Logo + Delivery */}
            <div className="flex shrink-0 items-center gap-6">
              <Link href="/" className="shrink-0">
                <Logo src={logoUrl} alt={logoAlt} isLoading={trackingLoading} />
              </Link>

              <DeliveryAddressButton />
            </div>

            {/* Search */}
            <div className="flex-1 px-8">
              <HeaderSearch fullWidth />
            </div>

            {/* Right Side */}
            <div className="flex shrink-0 items-center gap-5">
              {/* <LanguageSwitcher />

              <CurrencySwitcher /> */}
              <LocaleSwitcher />
              <div ref={accountRef} className="relative">
                {currentCustomer ? (
                  <>
                    <button
                      aria-label={t("ui.nav.account")}
                      className="flex flex-col items-start text-left text-ink hover:text-brand transition-colors"
                      onClick={() => setAccountOpen((value) => !value)}
                    >
                      <span className="text-[11px] font-normal leading-tight text-steel">
                        Hello, {currentCustomer.firstName}
                      </span>
                      <span className="flex items-center gap-1 text-[13px] font-bold leading-none">
                        Account & Lists
                        <ChevronDown
                          size={11}
                          className={cn(
                            "opacity-60 transition-transform",
                            accountOpen && "rotate-180",
                          )}
                        />
                      </span>
                    </button>
                    {accountOpen && (
                      <div className="absolute right-0 top-full z-50 mt-2.5 w-[230px] rounded-md border border-line bg-white p-3 shadow-[0_16px_32px_rgba(0,0,0,0.07)]">
                        <div className="border-b border-line pb-3">
                          <p className="truncate text-[13.5px] font-semibold text-ink">
                            {currentCustomer.firstName} {currentCustomer.lastName}
                          </p>
                          <p className="mt-0.5 truncate text-[12px] text-steel">
                            {currentCustomer.email}
                          </p>
                        </div>
                        <Link
                          href="/account"
                          onClick={() => setAccountOpen(false)}
                          className="mt-2 block rounded-md px-3 py-2 text-[13.5px] text-ink hover:bg-grey hover:text-brand"
                        >
                          My Account
                        </Link>
                        <Link
                          href="/wishlist"
                          onClick={() => setAccountOpen(false)}
                          className="mt-1 block rounded-md px-3 py-2 text-[13.5px] text-ink hover:bg-grey hover:text-brand"
                        >
                          My Wishlist {wishlistCount > 0 ? `(${wishlistCount})` : ""}
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
                  <Link
                    aria-label={t("ui.nav.account")}
                    href="/login"
                    className="flex flex-col items-start text-left text-ink hover:text-brand transition-colors"
                  >
                    <span className="text-[11px] font-normal leading-tight text-steel">
                      Hello, Sign in
                    </span>
                    <span className="flex items-center gap-1 text-[13px] font-bold leading-none">
                      Account & Lists
                      <ChevronDown size={11} className="opacity-60" />
                    </span>
                  </Link>
                )}
              </div>

              {currentCustomer && <NotificationBell role="customer" />}

              <Link
                href="/wishlist"
                aria-label="Wishlist"
                title="Wishlist"
                className="relative flex h-10 w-10 items-center justify-center rounded-md text-ink hover:bg-grey hover:text-brand transition-colors"
              >
                <Heart size={22} className="stroke-[1.75]" />
                {wishlistCount > 0 && (
                  <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#E31E24] text-[9px] font-bold text-white shadow-sm">
                    {wishlistCount}
                  </span>
                )}
              </Link>

              <button
                aria-label="Open cart"
                className="flex items-center gap-2 rounded-lg border border-[#D8E2E5] bg-[#F7FAFB] px-3 py-2 text-left text-ink transition-colors hover:border-brand hover:text-brand"
                onClick={openCart}
              >
                <div className="relative leading-none">
                  <ShoppingCart size={24} className="stroke-[1.75]" />
                  <span className="absolute left-[54%] top-[-4px] -translate-x-1/2 text-[11.5px] font-extrabold text-[#E31E24]">
                    {totals.itemCount}
                  </span>
                </div>
                <span className="leading-tight">
                  <span className="block text-[12px] font-bold">Clinical cart · {totals.currencySymbol}{totals.subtotal.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</span>
                  <span className="block text-[10px] font-medium text-steel">Tax at checkout · MOQ tiers apply</span>
                </span>
              </button>
            </div>
          </div>

          {/* Bottom Header Navigation */}
          <div className="hidden xl:flex items-center justify-center border-t border-line">
            <ul className="flex items-center justify-center gap-7 2xl:gap-9 text-[14.5px] font-medium text-ink">
              <li className="shrink-0">
                <Link
                  href="/"
                  className={cn(
                    "block whitespace-nowrap py-3.5 transition-colors border-b-2 hover:text-[#E31E24]",
                    pathname === "/"
                      ? "border-[#E31E24] font-semibold text-[#E31E24]"
                      : "border-transparent text-ink"
                  )}
                >
                  {t("ui.nav.home")}
                </Link>
              </li>
              <li className="shrink-0">
                <Link
                  href="/products"
                  className={cn(
                    "block whitespace-nowrap py-3.5 transition-colors border-b-2 hover:text-[#E31E24]",
                    pathname === "/products" || pathname?.startsWith("/products/")
                      ? "border-[#E31E24] font-semibold text-[#E31E24]"
                      : "border-transparent text-ink"
                  )}
                >
                  {t("ui.nav.products")}
                </Link>
              </li>
              {capabilitiesNav.length > 0 && (
                <li
                  className="relative shrink-0"
                  onMouseEnter={() => setCapsOpen(true)}
                  onMouseLeave={() => setCapsOpen(false)}
                >
                  <span
                    className={cn(
                      "flex cursor-pointer items-center gap-1.5 whitespace-nowrap py-3.5 border-b-2 transition-colors",
                      capabilitiesNav.some((link) => pathname === link.href || (link.href !== "/" && pathname?.startsWith(link.href)))
                        ? "border-[#E31E24] font-semibold text-[#E31E24]"
                        : "border-transparent text-ink hover:text-[#E31E24]"
                    )}
                  >
                    {t("ui.nav.capabilities")}
                    <ChevronDown size={11} className="opacity-60" />
                  </span>
                  {capsOpen && (
                    <div className="absolute left-1/2 -translate-x-1/2 top-full z-50 w-[260px] rounded-md border border-line bg-white p-3 shadow-[0_16px_32px_rgba(0,0,0,0.07)]">
                      {capabilitiesNav.map((link) => (
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
              )}
              {primaryNav.map((link) => {
                const isActive = pathname === link.href || (link.href !== "/" && pathname?.startsWith(link.href));
                return (
                  <li key={link.label} className="shrink-0">
                    <Link
                      href={link.href}
                      className={cn(
                        "block whitespace-nowrap py-3.5 transition-colors border-b-2 hover:text-[#E31E24]",
                        isActive
                          ? "border-[#E31E24] font-semibold text-[#E31E24]"
                          : "border-transparent text-ink"
                      )}
                    >
                      {label(link.label)}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          <nav aria-label="Clinical workflow" className="hidden xl:flex items-center justify-center gap-1 border-t border-line bg-[#F7FAFB] px-4 py-2">
            <span className="mr-2 text-[10.5px] font-bold uppercase tracking-[0.13em] text-steel">Clinical workflow</span>
            {clinicalWorkflowLinks.map((item) => (
              <Link key={item.label} href={item.href} className="rounded-md px-3 py-1.5 text-[12px] font-bold text-ink transition hover:bg-white hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Mobile Header */}
          <div className="flex h-16 items-center justify-between xl:hidden">
            <Link
              href="/"
              className="shrink-0"
              onClick={() => setMobileOpen(false)}
            >
              <Logo src={logoUrl} mobileSrc={mobileLogoUrl} alt={logoAlt} isMobile isLoading={trackingLoading} />
            </Link>

            <div className="flex items-center gap-1.5">
              <Link
                href="/wishlist"
                aria-label="Wishlist"
                title="Wishlist"
                className="relative flex h-10 w-10 items-center justify-center rounded-md text-ink transition-colors outline-none focus:outline-none [-webkit-tap-highlight-color:transparent]"
                onClick={() => setMobileOpen(false)}
              >
                <Heart size={22} className="stroke-[1.75]" />
                {wishlistCount > 0 && (
                  <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#E31E24] text-[9px] font-bold text-white">
                    {wishlistCount}
                  </span>
                )}
              </Link>

              <button
                type="button"
                aria-label="Cart"
                onClick={openCart}
                className="relative flex h-10 w-10 items-center justify-center rounded-md text-ink transition-colors outline-none focus:outline-none [-webkit-tap-highlight-color:transparent]"
              >
                <ShoppingCart size={22} className="stroke-[1.75]" />
                {totals.itemCount > 0 && (
                  <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#E31E24] text-[9px] font-bold text-white">
                    {totals.itemCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                aria-label={mobileOpen ? "Close menu" : t("ui.nav.menu")}
                onClick={() => setMobileOpen((v) => !v)}
                className="flex h-10 w-10 items-center justify-center rounded-md text-ink transition-colors outline-none focus:outline-none [-webkit-tap-highlight-color:transparent]"
              >
                {mobileOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <button
          aria-label="Close menu overlay"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 top-16 z-40 bg-black/45 backdrop-blur-[2px] xl:hidden"
        />
      )}

      <MobileMenu
        open={mobileOpen}
        links={mobileLinks}
        capabilitiesNav={capabilitiesNav}
        productsMegaNav={productsMegaNav}
        ctaLabel={ctaLabel}
        ctaHref={ctaHref}
        isLoggedIn={Boolean(currentCustomer)}
        customerName={currentCustomer ? `${currentCustomer.firstName ?? ""} ${currentCustomer.lastName ?? ""}`.trim() || currentCustomer.email : undefined}
        customerEmail={currentCustomer?.email}
        onLogout={logout}
        cartCount={totals.itemCount}
        wishlistCount={wishlistCount}
        onLinkClick={() => setMobileOpen(false)}
        onCartClick={openCart}
      />
    </header>
  );
}
