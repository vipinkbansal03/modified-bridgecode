"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  ShoppingCart,
  User,
  Heart,
  Package,
  ShieldCheck,
  PhoneCall,
  Sparkles,
  Layers,
  LogOut,
  ArrowRight,
  HelpCircle,
  Building2,
} from "lucide-react";
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
  customerName?: string;
  customerEmail?: string;
  onLogout?: () => void;
  cartCount: number;
  wishlistCount?: number;
  onLinkClick: () => void;
  onCartClick: () => void;
}

const getNavLinkIcon = (label: string) => {
  const l = label.toLowerCase();
  if (l.includes("product")) return Package;
  if (l.includes("quality") || l.includes("certif")) return ShieldCheck;
  if (l.includes("contact")) return PhoneCall;
  if (l.includes("design") || l.includes("engineering")) return Sparkles;
  if (l.includes("manufacturing") || l.includes("oem")) return Layers;
  if (l.includes("dealer")) return Building2;
  return HelpCircle;
};

export function MobileMenu({
  open,
  links,
  capabilitiesNav = [],
  productsMegaNav = [],
  ctaLabel,
  ctaHref,
  isLoggedIn,
  customerName,
  customerEmail,
  onLogout,
  cartCount,
  wishlistCount = 0,
  onLinkClick,
  onCartClick,
}: MobileMenuProps) {
  const [productsExpanded, setProductsExpanded] = useState(false);
  const [capabilitiesExpanded, setCapabilitiesExpanded] = useState(false);

  const userInitials = customerName
    ? customerName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ x: "-100%" }}
          animate={{ x: 0 }}
          exit={{ x: "-100%" }}
          transition={{
            duration: 0.3,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="fixed left-0 top-16 z-50 flex h-[calc(100svh-64px)] w-full flex-col overflow-hidden border-t border-line bg-white shadow-2xl xl:hidden"
        >
          {/* Main Scrollable Navigation Area */}
          <div className="flex-1 overflow-y-auto px-5 py-6 space-y-6">
            {/* Header Search Bar */}
            <div className="rounded-2xl border border-line bg-[#FAFAFA] p-1.5 shadow-2xs">
              <HeaderSearch fullWidth onNavigate={onLinkClick} />
            </div>

            {/* Guest Action Buttons */}
            {!isLoggedIn && (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  onClick={onLinkClick}
                  className="flex-1 rounded-full border border-ink bg-white px-4 py-2.5 text-center text-[13.5px] font-semibold text-ink hover:bg-ink hover:text-white transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  onClick={onLinkClick}
                  className="flex-1 rounded-full bg-[#E31E24] px-4 py-2.5 text-center text-[13.5px] font-semibold text-white hover:bg-[#B5151B] transition-colors"
                >
                  Create Account
                </Link>
              </div>
            )}

            {/* Navigation List */}
            <div className="space-y-2">
              {/* Expandable Products Section */}
              {productsMegaNav.length > 0 ? (
                <div className="rounded-xl border border-line bg-white overflow-hidden transition-colors">
                  <button
                    type="button"
                    onClick={() => setProductsExpanded((prev) => !prev)}
                    className="flex w-full items-center justify-between p-3 text-[15.5px] font-semibold text-ink hover:bg-[#FAFAFA] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E31E24]/10 text-[#E31E24]">
                        <Package size={17} />
                      </div>
                      <span>Products</span>
                    </div>
                    <ChevronDown
                      size={18}
                      className={`text-steel transition-transform duration-300 ${
                        productsExpanded ? "rotate-180 text-[#E31E24]" : ""
                      }`}
                    />
                  </button>

                  <AnimatePresence>
                    {productsExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                        className="overflow-hidden bg-[#FAFAFA] border-t border-line"
                      >
                        <div className="space-y-4 p-4">
                          {productsMegaNav.map((group, groupIdx) => (
                            <div key={groupIdx} className="space-y-1.5">
                              <Link
                                href={group.href}
                                onClick={onLinkClick}
                                className="flex items-center justify-between font-semibold text-[14px] text-ink hover:text-[#E31E24] transition-colors"
                              >
                                <span>{group.label}</span>
                                <ArrowRight size={13} className="text-steel" />
                              </Link>
                              {group.children && group.children.length > 0 && (
                                <div className="ml-2 flex flex-col gap-2 border-l-2 border-[#E31E24]/20 pl-3 py-1">
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
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <Link
                  href="/products"
                  onClick={onLinkClick}
                  className="flex items-center gap-3 rounded-xl border border-line bg-white p-4 text-[15.5px] font-medium text-ink hover:border-[#E31E24] hover:text-[#E31E24] transition-colors"
                >
                  <Package size={17} className="text-[#E31E24]" />
                  <span>Products</span>
                </Link>
              )}

              {/* Expandable Capabilities Section */}
              {capabilitiesNav.length > 0 && (
                <div className="rounded-xl border border-line bg-white overflow-hidden transition-colors">
                  <button
                    type="button"
                    onClick={() => setCapabilitiesExpanded((prev) => !prev)}
                    className="flex w-full items-center justify-between p-3 text-[15.5px] font-semibold text-ink hover:bg-[#FAFAFA] transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E31E24]/10 text-[#E31E24]">
                        <ShieldCheck size={17} />
                      </div>
                      <span>Capabilities</span>
                    </div>
                    <ChevronDown
                      size={18}
                      className={`text-steel transition-transform duration-300 ${
                        capabilitiesExpanded ? "rotate-180 text-[#E31E24]" : ""
                      }`}
                    />
                  </button>

                  <AnimatePresence>
                    {capabilitiesExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: "easeInOut" }}
                        className="overflow-hidden bg-[#FAFAFA] border-t border-line"
                      >
                        <div className="flex flex-col gap-2.5 p-4 ml-2 border-l-2 border-[#E31E24]/20 pl-3">
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
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Additional Primary Links */}
              {links
                .filter(
                  (l) =>
                    l.label !== "Products" &&
                    !capabilitiesNav.some((c) => c.label === l.label),
                )
                .map((link) => {
                  const Icon = getNavLinkIcon(link.label);
                  return (
                    <Link
                      key={link.label}
                      href={link.href}
                      onClick={onLinkClick}
                      className="flex items-center justify-between rounded-xl border border-line bg-white p-3 text-[15.5px] font-medium text-ink hover:border-[#E31E24] hover:text-[#E31E24] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-grey text-steel">
                          <Icon size={17} />
                        </div>
                        <span>{link.label}</span>
                      </div>
                      <ArrowRight size={14} className="text-steel" />
                    </Link>
                  );
                })}
            </div>

            {/* Quick Access Actions Grid */}
            <div className="grid grid-cols-3 gap-2.5 pt-2">
              <Link
                href={isLoggedIn ? "/account" : "/login"}
                onClick={onLinkClick}
                className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-line bg-[#FAFAFA] py-3.5 text-ink hover:border-[#E31E24] transition-colors"
              >
                <User size={19} className="text-steel" />
                <span className="text-[12px] font-semibold">Account</span>
              </Link>
              <Link
                href="/wishlist"
                onClick={onLinkClick}
                className="relative flex flex-col items-center justify-center gap-1.5 rounded-xl border border-line bg-[#FAFAFA] py-3.5 text-ink hover:border-[#E31E24] transition-colors"
              >
                <Heart size={19} className="text-steel" />
                <span className="text-[12px] font-semibold">Wishlist</span>
                {wishlistCount > 0 && (
                  <span className="absolute right-3 top-2 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-[#E31E24] text-[9.5px] font-extrabold text-white shadow-xs">
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
                className="relative flex flex-col items-center justify-center gap-1.5 rounded-xl border border-line bg-[#FAFAFA] py-3.5 text-ink hover:border-[#E31E24] transition-colors"
              >
                <ShoppingCart size={19} className="text-steel" />
                <span className="text-[12px] font-semibold">Cart</span>
                {cartCount > 0 && (
                  <span className="absolute right-3 top-2 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-[#E31E24] text-[9.5px] font-extrabold text-white shadow-xs">
                    {cartCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Drawer Footer with Currency / Country Switcher */}
          <div className="relative border-t border-line bg-[#FAFAFA] p-4">
            <LocaleSwitcher openUp align="left" />
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
