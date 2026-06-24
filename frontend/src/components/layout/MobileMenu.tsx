"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher";
import type { NavLink } from "@/types/common.types";

interface MobileMenuProps {
  open: boolean;
  links: NavLink[];
  ctaLabel: string;
  ctaHref: string;
  onLinkClick: () => void;
}

export function MobileMenu({
  open,
  links,
  ctaLabel,
  ctaHref,
  onLinkClick,
}: MobileMenuProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="absolute left-0 right-0 top-full z-50 overflow-hidden border-b border-line bg-white lg:hidden"
        >
          <div className="flex flex-col gap-1 px-5 py-8">
            {links.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                onClick={onLinkClick}
                className="rounded-md px-2 py-2.5 text-[15px] font-medium text-ink hover:bg-grey"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href={ctaHref}
              onClick={onLinkClick}
              className="mt-10 rounded-pill border border-ink px-4 py-2.5 text-center text-sm font-semibold text-ink"
            >
              {ctaLabel}
            </Link>
            <div className="mt-3 flex items-center border-t border-line pt-3">
              <LanguageSwitcher />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
