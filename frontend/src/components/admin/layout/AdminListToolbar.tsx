"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { Search, Filter, SlidersHorizontal, Download, Upload, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshButton } from "@/components/admin/RefreshButton";
import { cn } from "@/utils/cn";

export interface AdminListToolbarProps {
  /** Optional Search Configuration */
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    widthClassName?: string;
  };
  /** Optional Filters Configuration */
  filters?: {
    showFilters: boolean;
    onToggle: () => void;
    activeCount?: number;
    label?: string;
  };
  /** Optional Columns Configuration */
  columns?: {
    visibleColumns: Record<string, boolean>;
    onToggleColumn: (key: string) => void;
    options?: { key: string; label: string }[];
  };
  /** Optional Left Slot Custom Controls */
  leftExtra?: ReactNode;

  /** Optional Export Action */
  exportAction?: {
    onClick: () => void;
    label?: string;
    isLoading?: boolean;
    disabled?: boolean;
  };
  /** Optional Import Action */
  importAction?: {
    onClick: () => void;
    label?: string;
    isLoading?: boolean;
    disabled?: boolean;
  };
  /** Optional Refresh Action */
  refresh?: {
    onRefresh: () => void;
    isRefreshing?: boolean;
  };
  /** Optional Primary Action (+ Create / New) */
  primaryAction?: {
    href?: string;
    onClick?: () => void;
    label: string;
    icon?: ReactNode;
    disabled?: boolean;
  };
  /** Optional Right Slot Custom Controls */
  rightExtra?: ReactNode;

  /** Filter Panel Content (Animated slide-down) */
  filterPanel?: ReactNode;
  /** Optional Filter Reset Handler */
  onResetFilters?: () => void;
  /** Custom wrapper class */
  className?: string;
}

export function AdminListToolbar({
  search,
  filters,
  columns,
  leftExtra,
  exportAction,
  importAction,
  refresh,
  primaryAction,
  rightExtra,
  filterPanel,
  onResetFilters,
  className,
}: AdminListToolbarProps) {
  const hasLeftItems = Boolean(search || filters || columns || leftExtra);
  const hasRightItems = Boolean(exportAction || importAction || refresh || primaryAction || rightExtra);

  return (
    <div className={cn("adminListToolbar mb-5 space-y-3", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between min-h-[42px]">
        {/* LEFT SLOT */}
        {hasLeftItems ? (
          <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
            {search && (
              <div className={cn("relative flex-1 min-w-[200px] max-w-[280px]", search.widthClassName)}>
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9A9A]" />
                <input
                  type="text"
                  name="admin-search-query"
                  autoComplete="off"
                  value={search.value}
                  onChange={(e) => search.onChange(e.target.value)}
                  placeholder={search.placeholder ?? "Search..."}
                  className="h-10 w-full rounded-md border border-[#E6E6E6] bg-white py-2 pl-8 pr-3.5 text-[13.5px] text-[#1A1A1A] outline-none transition-colors focus:border-[#E31E24]"
                />
              </div>
            )}

            {filters && (
              <button
                type="button"
                onClick={filters.onToggle}
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-md border px-3.5 text-[13.5px] font-medium outline-none transition-all cursor-pointer shrink-0",
                  filters.showFilters
                    ? "border-[#E31E24] bg-[#FFF8F8] text-[#E31E24]"
                    : "border-[#E6E6E6] bg-white text-[#555555] hover:border-[#D1D1D1] hover:bg-[#FAFAFA]"
                )}
              >
                <Filter size={14} />
                <span>{filters.label ?? (filters.showFilters ? "Hide filters" : "Filters")}</span>
                {Boolean(filters.activeCount && filters.activeCount > 0) && (
                  <span className="ml-0.5 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#E31E24] px-1.5 text-[11px] font-bold text-white">
                    {filters.activeCount}
                  </span>
                )}
              </button>
            )}

            {columns && columns.options && (
              <details className="relative shrink-0">
                <summary className="list-none cursor-pointer rounded-md border border-[#E6E6E6] bg-white h-10 px-3.5 text-[13.5px] font-medium text-[#555555] outline-none flex items-center gap-2 hover:bg-[#FAFAFA] hover:border-[#D1D1D1] transition-all">
                  <SlidersHorizontal size={14} /> Columns
                </summary>
                <div className="absolute left-0 z-30 mt-2 w-[240px] rounded-md border border-[#E6E6E6] bg-white p-3 shadow-lg">
                  <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-[#9A9A9A]">
                    <Filter size={12} /> Visibility
                  </div>
                  <div className="grid gap-2 max-h-[260px] overflow-y-auto pr-1">
                    {columns.options.map((opt) => (
                      <label key={opt.key} className="flex items-center justify-between gap-3 rounded border border-[#F0F0F0] px-2.5 py-1.5 text-[12.5px] text-[#1A1A1A] cursor-pointer hover:bg-[#F8F8F8]">
                        <span>{opt.label}</span>
                        <input
                          type="checkbox"
                          checked={Boolean(columns.visibleColumns[opt.key])}
                          onChange={() => columns.onToggleColumn(opt.key)}
                          className="accent-[#E31E24]"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              </details>
            )}

            {leftExtra}
          </div>
        ) : <div />}

        {/* RIGHT SLOT */}
        {hasRightItems && (
          <div className="flex flex-wrap items-start   justify-start sm:justify-end gap-2 shrink-0">
            {rightExtra}

            {exportAction && (
              <button
                type="button"
                onClick={exportAction.onClick}
                disabled={exportAction.disabled || exportAction.isLoading}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border border-[#E6E6E6] bg-white px-3.5 text-[13px] font-semibold text-[#1A1A1A] transition-all hover:bg-[#F5F5F5] hover:border-[#D1D1D1] disabled:opacity-40"
              >
                <Download size={14} />
                {exportAction.isLoading ? "Exporting..." : (exportAction.label ?? "Export")}
              </button>
            )}

            {importAction && (
              <button
                type="button"
                onClick={importAction.onClick}
                disabled={importAction.disabled || importAction.isLoading}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border border-[#E6E6E6] bg-white px-3.5 text-[13px] font-semibold text-[#1A1A1A] transition-all hover:bg-[#F5F5F5] hover:border-[#D1D1D1] disabled:opacity-40"
              >
                <Upload size={14} />
                {importAction.isLoading ? "Importing..." : (importAction.label ?? "Import")}
              </button>
            )}

            {refresh && (
              <RefreshButton onRefresh={refresh.onRefresh} isRefreshing={Boolean(refresh.isRefreshing)} />
            )}

            {primaryAction && (
              primaryAction.href ? (
                <Link
                  href={primaryAction.href}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-[#E31E24] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#B5151B] shadow-xs"
                >
                  {primaryAction.icon ?? <Plus size={15} />}
                  {primaryAction.label}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={primaryAction.onClick}
                  disabled={primaryAction.disabled}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-[#E31E24] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#B5151B] disabled:opacity-50 shadow-xs"
                >
                  {primaryAction.icon ?? <Plus size={15} />}
                  {primaryAction.label}
                </button>
              )
            )}
          </div>
        )}
      </div>

      {/* FILTER PANEL */}
      <AnimatePresence>
        {filters?.showFilters && filterPanel && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="mt-2 rounded-lg border border-[#E6E6E6] bg-[#F8F8F8] p-4">
              {onResetFilters && (
                <div className="mb-3 flex items-center justify-between border-b border-[#EBEBEB] pb-2.5">
                  <span className="text-[13px] font-bold text-[#1A1A1A]">Filter Options</span>
                  <button
                    type="button"
                    onClick={onResetFilters}
                    className="text-[12.5px] font-medium text-[#E31E24] hover:underline cursor-pointer"
                  >
                    Reset All Filters
                  </button>
                </div>
              )}
              {filterPanel}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
