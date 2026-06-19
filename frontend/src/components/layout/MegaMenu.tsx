"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import type { NavMegaGroup } from "@/types/common.types";

interface MegaMenuProps {
  open: boolean;
  groups: NavMegaGroup[];
}

/** Dropdown panel shown under "Products" in the desktop nav. */
export function MegaMenu({ open, groups }: MegaMenuProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="absolute left-0 top-full z-50 grid w-[640px] grid-cols-2 gap-6 rounded-md border border-line bg-white p-7 shadow-[0_16px_32px_rgba(0,0,0,0.07)]"
        >
          {groups.map((group) => (
            <div key={group.label}>
              <Link href={group.href} className="text-sm font-semibold text-ink hover:text-brand">
                {group.label}
              </Link>
              <ul className="mt-2 flex flex-col">
                {group.children.map((child) => (
                  <li key={child.label}>
                    <Link href={child.href} className="block py-1.5 text-[14.5px] text-steel hover:text-brand">
                      {child.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
