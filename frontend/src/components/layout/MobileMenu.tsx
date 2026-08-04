"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ShoppingCart, User, Heart } from "lucide-react";
import { HeaderSearch } from "@/components/ui/HeaderSearch";
import { LocaleSwitcher } from "@/components/ui/LocaleSwitcher";
import type { NavLink, NavMegaGroup } from "@/types/common.types";

interface MobileMenuProps {
  open: boolean;
  links: NavLink[];
  capabilitiesNav?: NavLink[];
  productsMegaNav?: NavMegaGroup[];
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
  capabilitiesNav = [],
  productsMegaNav = [],
  ctaLabel,
  ctaHref,
  isLoggedIn,
  cartCount,
  wishlistCount = 0,
  onLinkClick,
  onCartClick,
}: MobileMenuProps) {
  const [productsExpanded, setProductsExpanded] = useState(false);
  const [capabilitiesExpanded, setCapabilitiesExpanded] = useState(false);

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
          className="fixed left-0 top-16 z-50 h-[calc(100svh-64px)] w-full overflow-y-auto border-t border-line bg-white shadow-2xl xl:hidden"
        >
          <div className="flex min-h-full flex-col px-4 py-6">
            <div>
              <HeaderSearch fullWidth onNavigate={onLinkClick} />
            </div>

            <div className="my-6 flex flex-col gap-3">
              {/* Expandable Products Section */}
              {productsMegaNav.length > 0 ? (
                <div className="border-b border-line/60 pb-3">
                  <button
                    type="button"
                    onClick={() => setProductsExpanded((prev) => !prev)}
                    className="flex w-full items-center justify-between py-2 text-[16px] font-semibold text-ink"
                  >
                    <span>Products</span>
                    <ChevronDown
                      size={18}
                      className={`text-steel transition-transform duration-200 ${
                        productsExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {productsExpanded && (
                    <div className="mt-2 space-y-3 pl-3">
                      {productsMegaNav.map((group, groupIdx) => (
                        <div key={groupIdx} className="space-y-1">
                          <Link
                            href={group.href}
                            onClick={onLinkClick}
                            className="block font-semibold text-[14px] text-ink hover:text-brand"
                          >
                            {group.label}
                          </Link>
                          {group.children && group.children.length > 0 && (
                            <div className="flex flex-col gap-1.5 pl-2 border-l border-line/60 my-1">
                              {group.children.map((child, childIdx) => (
                                <Link
                                  key={childIdx}
                                  href={child.href}
                                  onClick={onLinkClick}
                                  className="text-[13.5px] text-steel hover:text-ink transition-colors"
                                >
                                  {child.label}
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  href="/products"
                  onClick={onLinkClick}
                  className="flex items-center py-2 text-[16px] font-medium text-ink transition-colors hover:text-brand"
                >
                  Products
                </Link>
              )}

              {/* Expandable Capabilities Section */}
              {capabilitiesNav.length > 0 && (
                <div className="border-b border-line/60 pb-3">
                  <button
                    type="button"
                    onClick={() => setCapabilitiesExpanded((prev) => !prev)}
                    className="flex w-full items-center justify-between py-2 text-[16px] font-semibold text-ink"
                  >
                    <span>Capabilities</span>
                    <ChevronDown
                      size={18}
                      className={`text-steel transition-transform duration-200 ${
                        capabilitiesExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {capabilitiesExpanded && (
                    <div className="mt-2 flex flex-col gap-2 pl-3 border-l border-line/60">
                      {capabilitiesNav.map((cap, idx) => (
                        <Link
                          key={idx}
                          href={cap.href}
                          onClick={onLinkClick}
                          className="text-[14px] font-medium text-steel hover:text-ink transition-colors"
                        >
                          {cap.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Additional Primary Links */}
              {links
                .filter(
                  (l) =>
                    l.label !== "Products" &&
                    !capabilitiesNav.some((c) => c.label === l.label),
                )
                .map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    onClick={onLinkClick}
                    className="flex items-center py-1.5 text-[16px] font-medium text-ink transition-colors hover:text-brand"
                  >
                    {link.label}
                  </Link>
                ))}
            </div>

            <Link
              href={ctaHref}
              onClick={onLinkClick}
              className="rounded-pill border border-ink px-4 py-3 text-center text-sm font-semibold text-ink transition-colors hover:bg-ink hover:text-white"
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
                  <span className="absolute right-3 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-[#E31E24] text-[9px] font-bold text-white">
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
