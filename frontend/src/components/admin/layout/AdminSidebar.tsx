"use client";

import { useState, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronRight, X } from "lucide-react";

import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { sidebarSections } from "./data/sidebarNavigation";
import { cn } from "@/utils/cn";

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

const SIDEBAR_SCROLL_STORAGE_KEY = "admin_sidebar_scroll_top";
const SIDEBAR_EXPANDED_STORAGE_KEY = "admin_sidebar_expanded_menus";
let inMemorySidebarScrollTop = 0;
let inMemoryExpandedMenus: Record<string, boolean> = {};

function getBestActiveHref(currentPath: string): string | null {
  let bestHref: string | null = null;
  let bestLength = 0;

  sidebarSections.forEach((section) => {
    section.items.forEach((item) => {
      const evaluateHref = (href?: string, matchHrefs?: string[]) => {
        if (!href) return;
        const allHrefs = [href, ...(matchHrefs || [])];
        const isMatch = allHrefs.some(
          (h) =>
            currentPath === h ||
            (h !== "/admin/dashboard" && currentPath.startsWith(h + "/"))
        );
        if (isMatch && href.length >= bestLength) {
          bestHref = href;
          bestLength = href.length;
        }
      };

      evaluateHref(item.href, item.matchHrefs);
      item.subItems?.forEach((sub) => evaluateHref(sub.href, sub.matchHrefs));
    });
  });

  return bestHref;
}

function getActiveParentMenus(currentPath: string): Record<string, boolean> {
  const activeMap: Record<string, boolean> = {};
  const bestHref = getBestActiveHref(currentPath);
  if (!bestHref) return activeMap;

  sidebarSections.forEach((section) => {
    section.items.forEach((item) => {
      if (item.subItems) {
        const hasActiveSub = item.subItems.some((sub) => sub.href === bestHref);
        if (hasActiveSub) {
          activeMap[item.label] = true;
        }
      }
    });
  });
  return activeMap;
}

function getInitialExpandedMenus(pathname: string): Record<string, boolean> {
  let stored: Record<string, boolean> = {};
  if (typeof window !== "undefined") {
    try {
      const raw = sessionStorage.getItem(SIDEBAR_EXPANDED_STORAGE_KEY);
      if (raw) stored = JSON.parse(raw);
    } catch {}
  }
  const merged = { ...stored, ...inMemoryExpandedMenus, ...getActiveParentMenus(pathname) };
  inMemoryExpandedMenus = merged;
  return merged;
}

interface AdminSidebarProps {
  open: boolean;
  onClose: () => void;
}

export function AdminSidebar({ open, onClose }: AdminSidebarProps) {
  const pathname = usePathname();
  const { user, hasPermission, logout } = useAdminAuth();
  const bestActiveHref = useMemo(() => getBestActiveHref(pathname), [pathname]);
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>(() => {
    return getInitialExpandedMenus(pathname);
  });
  const navRef = useRef<HTMLElement | null>(null);

  // Auto-expand menu folders that contain the active path on route change without collapsing existing open menus
  useIsomorphicLayoutEffect(() => {
    const activeParents = getActiveParentMenus(pathname);
    if (Object.keys(activeParents).length > 0) {
      setExpandedMenus((prev) => {
        const next = { ...prev, ...activeParents };
        inMemoryExpandedMenus = next;
        return next;
      });
    }
  }, [pathname]);

  // Restore scroll position synchronously on route change or initial load before paint
  useIsomorphicLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    let targetScroll = inMemorySidebarScrollTop;
    if (!targetScroll && typeof window !== "undefined") {
      try {
        const stored = sessionStorage.getItem(SIDEBAR_SCROLL_STORAGE_KEY);
        if (stored) targetScroll = parseFloat(stored);
      } catch {}
    }

    if (targetScroll > 0) {
      nav.scrollTop = targetScroll;
    } else {
      const activeEl = nav.querySelector<HTMLElement>('[data-sidebar-active="true"]');
      if (activeEl) {
        const navRect = nav.getBoundingClientRect();
        const activeRect = activeEl.getBoundingClientRect();
        const isAbove = activeRect.top < navRect.top + 10;
        const isBelow = activeRect.bottom > navRect.bottom - 10;

        if (isAbove || isBelow) {
          activeEl.scrollIntoView({ block: "nearest", behavior: "auto" });
          inMemorySidebarScrollTop = nav.scrollTop;
          try {
            sessionStorage.setItem(SIDEBAR_SCROLL_STORAGE_KEY, String(nav.scrollTop));
          } catch {}
        }
      }
    }
  }, [pathname]);

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
    setExpandedMenus((prev) => {
      const next = {
        ...prev,
        [label]: !prev[label],
      };
      inMemoryExpandedMenus = next;
      if (typeof window !== "undefined") {
        try {
          sessionStorage.setItem(SIDEBAR_EXPANDED_STORAGE_KEY, JSON.stringify(next));
        } catch {}
      }
      return next;
    });
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
              <span className="text-[14px] font-bold tracking-wide text-white">
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

                  // Check if this item link is active (only if exact/best match)
                  const isLinkActive = item.href ? item.href === bestActiveHref : false;
                  const isFolderExpanded = !!expandedMenus[item.label];

                  // Folders / Expandable items
                  if (item.subItems) {
                    const isAnySubActive = item.subItems.some(
                      (sub) => sub.href === bestActiveHref,
                    );

                    return (
                      <div key={item.label} className="space-y-[1px]">
                        <button
                          type="button"
                          onClick={() => toggleMenu(item.label)}
                          className={cn(
                            "w-full flex items-center gap-3 px-5 py-2 text-[13px] transition-colors text-left",
                            isAnySubActive
                              ? "text-white font-medium hover:bg-white/5"
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
                              const subActive = sub.href === bestActiveHref;
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
