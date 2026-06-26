"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  Search,
  User,
  ShoppingCart,
  Menu,
  X,
  Package,
  Heart,
  LogOut,
  Settings,
} from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { MegaMenu } from "@/components/layout/MegaMenu";
import { MobileMenu } from "@/components/layout/MobileMenu";
import { CurrencySwitcher } from "@/components/ui/CurrencySwitcher";
import { SearchOverlay } from "@/components/ui/SearchOverlay";
import { useQuoteCart } from "@/contexts/QuoteCartContext";
import { useCustomerLogout, useCustomerMe } from "@/hooks/api/useCustomerLogin";
import navigation from "@/data/navigation.json";
import { cn } from "@/utils/cn";
import type { NavigationData } from "@/types/common.types";

const nav = navigation as NavigationData;

export function Header() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [scrolled, setScrolled] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [capsOpen, setCapsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { totals } = useQuoteCart();
  const { data: customer } = useCustomerMe();
  const logoutMutation = useCustomerLogout();

  function handleLogout() {
    logoutMutation.mutate(undefined, {
      onSettled: () => {
        setAccountOpen(false);
        queryClient.removeQueries({ queryKey: ["customer", "me"] });
        router.push("/login");
      },
    });
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 bg-white transition-shadow duration-300",
        scrolled &&
          "shadow-[0_1px_0_rgba(0,0,0,0.03),0_12px_28px_-8px_rgba(0,0,0,0.08)]",
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
                Products
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
                Capabilities
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
                      {link.label}
                    </Link>
                  ))}
                </div>
              )}
            </li>
            {nav.primary.slice(1).map((link) => (
              <li key={link.label}>
                <Link href={link.href} className="block py-7 hover:text-brand">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="hidden items-center gap-5 lg:flex">
            <CurrencySwitcher />
            <button
              aria-label="Search"
              className="text-ink hover:text-brand"
              onClick={() => setSearchOpen(true)}
            >
              <Search size={18} />
            </button>
            {customer ? (
              <div
                className="relative leading-none"
                onMouseEnter={() => setAccountOpen(true)}
                onMouseLeave={() => setAccountOpen(false)}
              >
                <button
                  type="button"
                  onClick={() => setAccountOpen((value) => !value)}
                  aria-label="My account"
                  aria-expanded={accountOpen}
                  className="text-ink hover:text-brand"
                >
                  <User size={18} />
                </button>

                {accountOpen && (
                  <div className="absolute right-[10%] translate-x-[10%] top-[100%] z-50 w-[285px] overflow-hidden rounded-2xl border border-line bg-white shadow-[0_24px_60px_rgba(0,0,0,0.14)]">
                    <div className="bg-gradient-to-br from-[#E31E24] to-[#9F1116] p-4 text-white">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/18 text-[15px] font-semibold">
                          {customer.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-[14px] font-semibold">
                            {customer.name}
                          </p>
                          <p className="truncate text-[12px] text-white/75">
                            {customer.email}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 inline-flex rounded-full bg-white/16 px-3 py-1 text-[11px] font-medium">
                        {customer.role.name}
                      </div>
                    </div>

                    <div className="p-2">
                      <Link
                        href="/account"
                        onClick={() => setAccountOpen(false)}
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium text-ink transition-colors hover:bg-offwhite hover:text-brand"
                      >
                        <Settings size={16} />
                        My account
                      </Link>
                      <Link
                        href="/account"
                        onClick={() => setAccountOpen(false)}
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium text-ink transition-colors hover:bg-offwhite hover:text-brand"
                      >
                        <Package size={16} />
                        My orders
                      </Link>
                      <Link
                        href="/account"
                        onClick={() => setAccountOpen(false)}
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium text-ink transition-colors hover:bg-offwhite hover:text-brand"
                      >
                        <Heart size={16} />
                        Wishlist
                      </Link>
                    </div>

                    <div className="border-t border-line p-2">
                      <button
                        type="button"
                        onClick={handleLogout}
                        disabled={logoutMutation.isPending}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13.5px] font-medium text-[#B5151B] transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <LogOut size={16} />
                        {logoutMutation.isPending ? "Logging out..." : "Logout"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/login"
                aria-label="Login"
                title="Login"
                className="text-ink hover:text-brand"
              >
                <User size={18} />
              </Link>
            )}
            <button
              aria-label="Quote Cart"
              className="relative text-ink hover:text-brand"
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
              className="rounded-pill border border-ink px-4.5 py-2.5 text-[14.5px] font-semibold text-ink transition-colors hover:bg-ink hover:text-white"
            >
              {nav.ctaLabel}
            </Link>
          </div>

          <button
            aria-label="Menu"
            className="text-ink lg:hidden"
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      <div className="hidden border-b border-line bg-offwhite lg:block">
        <div className="mx-auto h-[50px] max-w-wrap px-5 sm:px-10">
          <div className="subnav-scrollbar flex h-full items-center gap-7 overflow-x-auto pb-1">
            {nav.subNav.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="whitespace-nowrap text-[13.5px] text-steel hover:text-brand"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {mobileOpen && (
        <button
          aria-label="Close menu overlay"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 top-20 z-40 bg-black/45 backdrop-blur-[2px] lg:hidden"
        />
      )}

      <MobileMenu
        open={mobileOpen}
        links={[
          nav.primary[0],
          ...nav.capabilitiesMenu,
          ...nav.primary.slice(1),
        ]}
        ctaLabel={nav.ctaLabel}
        ctaHref={nav.ctaHref}
        onLinkClick={() => setMobileOpen(false)}
      />

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
}
