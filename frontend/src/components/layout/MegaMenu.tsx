"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import type { NavMegaGroup } from "@/types/common.types";

interface MegaMenuProps {
  open: boolean;
  groups: NavMegaGroup[];
}

export function MegaMenu({ open, groups }: MegaMenuProps) {
  if (!groups.length) return null;

  return (
    <AnimatePresence>
      <div className="fixed left-1/2 z-50 -translate-x-1/2">
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="mega-scrollbar w-[1100px] max-h-[calc(100vh-180px)] overflow-y-auto rounded-md border border-line bg-white p-5 shadow-[0_24px_60px_rgba(15,23,42,0.12)]"
          >
            <div className="grid grid-cols-3 gap-4">
              {groups.map((group) => (
                <div
                  key={group.label}
                  className="rounded-xl p-4 transition hover:bg-slate-50"
                >
                  <Link
                    href={group.href}
                    className="group flex items-center justify-between text-sm font-semibold text-ink hover:text-brand"
                  >
                    <span>{group.label}</span>
                    <ChevronRight className="h-4 w-4 opacity-0 transition group-hover:translate-x-1 group-hover:opacity-100" />
                  </Link>

                  <ul className="mt-3 space-y-1">
                    {group.children.map((child) => (
                      <li key={child.label}>
                        <Link
                          href={child.href}
                          className="block rounded-md px-2 py-1.5 text-[14px] text-steel transition hover:bg-white hover:text-brand hover:shadow-sm"
                        >
                          {child.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </AnimatePresence>
  );
}
