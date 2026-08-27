"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight, X } from "lucide-react";

import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { sidebarSections } from "./data/sidebarNavigation";
import { cn } from "@/utils/cn";

const SIDEBAR_SCROLL_STORAGE_KEY = "admin_sidebar_scroll_top";
let inMemorySidebarScrollTop = 0;

interface AdminSidebarProps {
  open: boolean;
  onClose: () => void;
}

export function AdminSidebar({ open, onClose }: AdminSidebarProps) {
  const pathname = usePathname();
  const { user, hasPermission, logout } = useAdminAuth();
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({});
  const navRef = useRef<HTMLElement | null>(null);

  // Auto-expand menu folders that contain the active path
  useEffect(() => {
    const initial: Record<string, boolean> = {};
    sidebarSections.forEach((section) => {
      section.items.forEach((item) => {
        if (item.subItems) {
          const hasActiveSub = item.subItems.some(
            (sub) => pathname === sub.href || (sub.href !== "/admin/dashboard" && pathname.startsWith(sub.href + "/")),
          );
          if (hasActiveSub) {
            initial[item.label] = true;
          }
        }
      });
    });
    setExpandedMenus((prev) => ({ ...initial, ...prev }));
  }, [pathname]);

  // Restore scroll position and ensure active element is in view
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    // 1. Restore previous scroll position immediately
    let targetScroll = inMemorySidebarScrollTop;
    if (!targetScroll && typeof window !== "undefined") {
      try {
        const stored = sessionStorage.getItem(SIDEBAR_SCROLL_STORAGE_KEY);
        if (stored) targetScroll = parseFloat(stored);
      } catch {}
    }

    if (targetScroll > 0) {
      nav.scrollTop = targetScroll;
    }

    // 2. Check if the active item is currently outside the visible viewport
    const frameId = requestAnimationFrame(() => {
      const activeEl = nav.querySelector<HTMLElement>('[data-sidebar-active="true"]');
      if (!activeEl) return;

      const navRect = nav.getBoundingClientRect();
      const activeRect = activeEl.getBoundingClientRect();

      // Check if active item is outside current viewport with safe padding
      const isAbove = activeRect.top < navRect.top + 10;
      const isBelow = activeRect.bottom > navRect.bottom - 10;

      if (isAbove || isBelow) {
        activeEl.scrollIntoView({ block: "nearest", behavior: "auto" });
        inMemorySidebarScrollTop = nav.scrollTop;
        try {
          sessionStorage.setItem(SIDEBAR_SCROLL_STORAGE_KEY, String(nav.scrollTop));
        } catch {}
      }
    });

    return () => cancelAnimationFrame(frameId);
  }, [pathname, expandedMenus]);

  const handleNavScroll = (e: React.UIEvent<HTMLElement>) => {
    const top = e.currentTarget.scrollTop;
    inMemorySidebarScrollTop = top;
    try {
      sessionStorage.setItem(SIDEBAR_SCROLL_STORAGE_KEY, String(top));
    } catch {}
  };

  const handleLinkClick = () => {
    if (navRef.current) {
      const currentTop = navRef.current.scrollTop;
      inMemorySidebarScrollTop = currentTop;
      try {
        sessionStorage.setItem(SIDEBAR_SCROLL_STORAGE_KEY, String(currentTop));
      } catch {}
    }
    onClose();
  };

  const toggleMenu = (label: string) => {
    setExpandedMenus((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  // Filter sections and items based on permissions
  const visibleSections = useMemo(() => {
    return sidebarSections
      .map((section) => {
        const visibleItems = section.items
          .map((item) => {
            if (item.subItems) {
              const visibleSubItems = item.subItems.filter(
                (sub) => !sub.permission || hasPermission(sub.permission),
              );
              return { ...item, subItems: visibleSubItems };
            }
            return item;
          })
          .filter((item) => {
            if (item.subItems) {
              return item.subItems.length > 0;
            }
            return !item.permission || hasPermission(item.permission);
          });
        return { ...section, items: visibleItems };
      })
      .filter((section) => section.items.length > 0);
  }, [hasPermission]);

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
          "fixed left-0 top-0 z-50 flex h-screen w-[240px] flex-col bg-[#111] text-white transition-transform duration-200 lg:translate-x-0 lg:relative lg:z-auto border-r border-white/5",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Logo Section */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-white/10 bg-[#090909]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#E31E24] font-bold text-white text-[13px] tracking-wider shrink-0">
              MO
            </div>
            <div>
              <span className="text-[14px] font-bold tracking-wide text-white animate-fade-in">
                ModOrtho
              </span>
              <div className="text-[10.5px] text-white/50 mt-0.5">Admin Console</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden text-white/60 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation list */}
        <nav
          ref={navRef}
          onScroll={handleNavScroll}
          className="admin-sidebar-scrollbar flex-1 overflow-y-auto py-5 space-y-6"
        >
          {visibleSections.map((section) => (
            <div key={section.title} className="space-y-1.5">
              {/* Section Header */}
              <div className="px-5 text-[10px] font-bold uppercase tracking-wider text-white/30">
                {section.title}
              </div>

              {/* Items */}
              <div className="space-y-[2px]">
                {section.items.map((item) => {
                  const Icon = item.icon;

                  // Check if this item link is active
                  const isLinkActive = item.href
                    ? pathname === item.href ||
                      (item.href !== "/admin/dashboard" && (pathname.startsWith(item.href + "/") || pathname === item.href))
                    : false;

                  const isFolderExpanded = !!expandedMenus[item.label];

                  // Folders / Expandable items
                  if (item.subItems) {
                    const isAnySubActive = item.subItems.some(
                      (sub) => pathname === sub.href || (sub.href !== "/admin/dashboard" && pathname.startsWith(sub.href + "/")),
                    );

                    return (
                      <div key={item.label} className="space-y-[1px]">
                        <button
                          type="button"
                          onClick={() => toggleMenu(item.label)}
                          className={cn(
                            "w-full flex items-center gap-3 px-5 py-2 text-[13px] transition-colors text-left",
                            isAnySubActive
                              ? "text-white font-medium bg-white/10"
                              : "text-white/60 hover:bg-white/5 hover:text-white",
                          )}
                        >
                          <Icon size={15} className="flex-none" />
                          <span>{item.label}</span>
                          <ChevronDown
                            size={12}
                            className={cn(
                              "ml-auto opacity-50 transition-transform duration-200",
                              isFolderExpanded && "rotate-180",
                            )}
                          />
                        </button>

                        {/* Dropdown Items list */}
                        {isFolderExpanded && (
                          <div className="bg-black/20 py-1 ml-5 border-l border-white/5 pl-2 space-y-[1px]">
                            {item.subItems.map((sub) => {
                              const subActive =
                                pathname === sub.href ||
                                (sub.href !== "/admin/dashboard" && pathname.startsWith(sub.href + "/"));
                              return (
                                <Link
                                  key={sub.href}
                                  href={sub.href}
                                  onClick={handleLinkClick}
                                  data-sidebar-active={subActive ? "true" : undefined}
                                  aria-current={subActive ? "page" : undefined}
                                  className={cn(
                                    "flex items-center py-1.5 pl-3 pr-3 text-[12.5px] transition-colors rounded-sm",
                                    subActive
                                      ? "text-white font-semibold bg-white/10"
                                      : "text-white/40 hover:text-white hover:bg-white/5",
                                  )}
                                >
                                  {sub.label}
                                </Link>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  }

                  // Standard Link Item
                  return (
                    <Link
                      key={item.href}
                      href={item.href || "#"}
                      onClick={handleLinkClick}
                      data-sidebar-active={isLinkActive ? "true" : undefined}
                      aria-current={isLinkActive ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 px-5 py-2 text-[13px] transition-colors border-l-2 pl-[18px]",
                        isLinkActive
                          ? "bg-white/10 text-white font-semibold border-l-[#E31E24]"
                          : "text-white/60 hover:bg-white/5 hover:text-white border-l-transparent",
                      )}
                    >
                      <Icon size={15} className="flex-none" />
                      <span>{item.label}</span>
                      {isLinkActive && !item.subItems && (
                        <ChevronRight size={12} className="ml-auto opacity-60" />
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User Card at bottom */}
        <div className="mt-auto p-4 border-t border-white/10 bg-[#090909]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E31E24] text-xs font-bold text-white uppercase shrink-0">
              {user?.name?.charAt(0) || "A"}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold text-white">{user?.name || "Admin"}</div>
              <div className="truncate text-[11px] text-white/50">{user?.email || "admin@modortho.com"}</div>
              <div className="truncate text-[11px] text-white/50 mt-0.5">{user?.role || "Staff Member"}</div>
            </div>
          </div>
          <div className="flex items-center justify-between mt-3 text-[11.5px] text-white/40">
            <Link href="/admin/settings" onClick={handleLinkClick} className="hover:text-white transition-colors">
              View profile
            </Link>
            <button onClick={logout} className="hover:text-white transition-colors">
              Sign out
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
