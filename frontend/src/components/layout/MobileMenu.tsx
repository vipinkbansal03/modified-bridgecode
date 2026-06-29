"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ShoppingCart, User } from "lucide-react";
import { CurrencySwitcher } from "@/components/ui/CurrencySwitcher";
import { HeaderSearch } from "@/components/ui/HeaderSearch";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import type { NavLink } from "@/types/common.types";

interface MobileMenuProps {
  open: boolean;
  links: NavLink[];
  ctaLabel: string;
  ctaHref: string;
  isLoggedIn: boolean;
  cartCount: number;
  onLinkClick: () => void;
  onCartClick: () => void;
}

export function MobileMenu({
  open,
  links,
  ctaLabel,
  ctaHref,
  isLoggedIn,
  cartCount,
  onLinkClick,
  onCartClick,
}: MobileMenuProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "calc(100svh - 80px)" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="fixed left-0 right-0 top-20 z-50 overflow-y-auto border-b border-line bg-white lg:hidden"
        >
          <div className="flex min-h-full flex-col gap-1 px-5 py-6">
            <div className="mb-3">
              <HeaderSearch fullWidth onNavigate={onLinkClick} />
            </div>
            {links.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                onClick={onLinkClick}
                className="rounded-md px-2 py-2 text-[15px] font-medium text-ink hover:bg-grey"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href={ctaHref}
              onClick={onLinkClick}
              className="mt-5 rounded-pill border border-ink px-4 py-2.5 text-center text-sm font-semibold text-ink"
            >
              {ctaLabel}
            </Link>
            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line pt-3">
              <Link
                href={isLoggedIn ? "/account" : "/login"}
                onClick={onLinkClick}
                className="flex h-11 items-center justify-center rounded-md border border-line text-ink"
                aria-label="Account"
              >
                <User size={17} />
              </Link>
              <button
                type="button"
                onClick={() => {
                  onLinkClick();
                  onCartClick();
                }}
                className="relative flex h-11 items-center justify-center rounded-md border border-line text-ink"
                aria-label="Cart"
              >
                <ShoppingCart size={17} />
                {cartCount > 0 && (
                  <span className="absolute right-3 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-[#E31E24] text-[9px] font-bold text-white">
                    {cartCount}
                  </span>
                )}
              </button>
            </div>
            <div className="mt-3 grid gap-3 border-t border-line pt-3">
              <LanguageSwitcher mobileFullWidth />
              <div className="rounded-md border border-line px-3 py-2">
                <CurrencySwitcher />
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
