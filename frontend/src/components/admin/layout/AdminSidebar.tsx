"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, X } from "lucide-react";

import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { cmsItems, navItems } from "./data/sidebarNavigation";
import { cn } from "@/utils/cn";

interface AdminSidebarProps {
  open: boolean;
  onClose: () => void;
}

export function AdminSidebar({ open, onClose }: AdminSidebarProps) {
  const pathname = usePathname();
  const { user, hasPermission } = useAdminAuth();

  const visibleItems = navItems.filter(
    (item) => !item.permission || hasPermission(item.permission),
  );

  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-screen w-[240px] flex-col bg-[#111] text-white transition-transform duration-200 lg:translate-x-0 lg:relative lg:z-auto",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
          <div>
            <span className="text-[13px] font-semibold tracking-[0.08em] text-white uppercase">
              Modern Ortho
            </span>
            <div className="text-[11px] text-white/40 mt-0.5">Admin Panel</div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden text-white/60 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* User badge */}
        <div className="px-5 py-3 border-b border-white/10">
          <div className="text-[13px] font-medium text-white">{user?.name}</div>
          <div className="text-[11px] text-white/40">{user?.role}</div>
        </div>

        {/* Nav */}
        <nav className="admin-sidebar-scrollbar flex-1 overflow-y-auto py-3">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href ||
              (item.href !== "/admin/dashboard" &&
                pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-5 py-2.5 text-[13.5px] transition-colors",
                  active
                    ? "bg-white/10 text-white font-medium"
                    : "text-white/60 hover:bg-white/5 hover:text-white",
                )}
              >
                <Icon size={16} className="flex-none" />
                {item.label}
                {active && (
                  <ChevronRight size={12} className="ml-auto opacity-60" />
                )}
              </Link>
            );
          })}

          {/* CMS section */}
          <div className="mt-3 mb-1 px-5 text-[10px] font-semibold uppercase tracking-widest text-white/25">
            Content (CMS)
          </div>
          {cmsItems.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-3 px-5 py-2.5 text-[13.5px] transition-colors",
                  active
                    ? "bg-white/10 text-white font-medium"
                    : "text-white/60 hover:bg-white/5 hover:text-white",
                )}
              >
                <Icon size={16} className="flex-none" />
                {item.label}
                {active && (
                  <ChevronRight size={12} className="ml-auto opacity-60" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-white/10 text-[11px] text-white/30">
          v1.0.0 · modortho.com
        </div>
      </aside>
    </>
  );
}
