"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ShoppingCart, User, Heart } from "lucide-react";
import { HeaderSearch } from "@/components/ui/HeaderSearch";
import { LocaleSwitcher } from "@/components/ui/LocaleSwitcher";
import type { NavLink } from "@/types/common.types";

interface MobileMenuProps {
  open: boolean;
  links: NavLink[];
  ctaLabel: string;
  ctaHref: string;
  isLoggedIn: boolean;
  cartCount: number;
  wishlistCount?: number;
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
  wishlistCount = 0,
  onLinkClick,
  onCartClick,
}: MobileMenuProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ x: "-100%" }}
          animate={{ x: 0 }}
          exit={{ x: "-100%" }}
          transition={{
            duration: 0.28,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="
            fixed left-0  top-16 z-50  h-[calc(100svh-64px)]  w-full overflow-y-auto   bg-white shadow-2xl xl:hidden border-t border-line
          "
        >
          <div className="flex min-h-full flex-col px-4 py-6">
            <div>
              <HeaderSearch fullWidth onNavigate={onLinkClick} />
            </div>
            <div className="flex flex-col gap-4 my-7">
              {links.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  onClick={onLinkClick}
                  className="flex items-center rounded-lg text-[16px] font-medium text-ink transition-colors hover:bg-grey"
                >
                  {link.label}
                </Link>
              ))}
            </div>
            <Link
              href={ctaHref}
              onClick={onLinkClick}
              className="8 rounded-pill border border-ink px-4 py-3 text-center text-sm font-semibold text-ink transition-colors hover:bg-ink hover:text-white"
            >
              {ctaLabel}
            </Link>
            <div className="mt-6 grid grid-cols-3 gap-2 border-t border-line pt-3">
              <Link
                href={isLoggedIn ? "/account" : "/login"}
                onClick={onLinkClick}
                className="flex h-12 items-center justify-center rounded-md border border-line text-ink"
                aria-label="Account"
                title="Account"
              >
                <User size={18} />
              </Link>
              <Link
                href="/wishlist"
                onClick={onLinkClick}
                className="relative flex h-12 items-center justify-center rounded-md border border-line text-ink"
                aria-label="Wishlist"
                title="Wishlist"
              >
                <Heart size={18} />
                {wishlistCount > 0 && (
                  <span className="absolute right-3 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-[#E31E24] text-[9px] font-bold text-white">
                    {wishlistCount}
                  </span>
                )}
              </Link>
              <button
                type="button"
                onClick={() => {
                  onLinkClick();
                  onCartClick();
                }}
                className="relative flex h-12 items-center justify-center rounded-md border border-line text-ink"
                aria-label="Cart"
                title="Cart"
              >
                <ShoppingCart size={18} />
                {cartCount > 0 && (
                  <span className="absolute right-3 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-[#F08804] text-[9px] font-bold text-white">
                    {cartCount}
                  </span>
                )}
              </button>
            </div>
            <div className="mt-6 border-t border-line pt-5">
              <div className="w-full">
                <LocaleSwitcher />
              </div>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
