"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { Save, ChevronLeft, ArrowLeft } from "lucide-react";
import { cn } from "@/utils/cn";

export interface AdminStickySaveBarProps {
  title: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  isDirty?: boolean;
  isReadOnly?: boolean;
  readOnlyMessage?: string;
  saving?: boolean;
  savingText?: string;
  saveLabel?: string;
  onSave?: () => void | Promise<void>;
  showSave?: boolean;
  backHref?: string;
  onBack?: () => void;
  backLabel?: string;
  secondaryActions?: ReactNode;
  className?: string;
  stickyOffsetClass?: string;
}

export function AdminStickySaveBar({
  title,
  subtitle = "Changes are not applied until you save.",
  badge,
  isDirty = false,
  isReadOnly = false,
  readOnlyMessage = "Read-only mode. You do not have permissions to make changes.",
  saving = false,
  savingText = "Saving…",
  saveLabel = "Save Changes",
  onSave,
  showSave = true,
  backHref,
  onBack,
  backLabel = "Back",
  secondaryActions,
  className,
  stickyOffsetClass = "-top-5 sm:-top-6",
}: AdminStickySaveBarProps) {
  return (
    <div
      className={cn(
        "sticky z-30 mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E6E6E6] bg-white px-4 py-3 shadow-xs backdrop-blur",
        stickyOffsetClass,
        className
      )}
    >
      <div className="min-w-0 pr-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-[15px] font-semibold text-[#1A1A1A] truncate">{title}</h2>
          {badge}
        </div>
        {isReadOnly ? (
          <p className="mt-0.5 text-[11.5px] font-medium text-amber-600">{readOnlyMessage}</p>
        ) : subtitle ? (
          <p className="mt-0.5 text-[11.5px] text-[#6B6B6B]">{subtitle}</p>
        ) : null}
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        {isDirty && !isReadOnly && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 border border-amber-200 shadow-2xs">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            Unsaved Changes
          </span>
        )}

        {secondaryActions}

        {backHref ? (
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E6E6E6] bg-white px-3.5 py-2 text-[13px] font-medium text-[#1A1A1A] hover:bg-[#F5F5F5] transition-colors shadow-2xs"
          >
            <ChevronLeft size={14} className="text-gray-500" />
            <span>{backLabel}</span>
          </Link>
        ) : onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E6E6E6] bg-white px-3.5 py-2 text-[13px] font-medium text-[#1A1A1A] hover:bg-[#F5F5F5] transition-colors shadow-2xs"
          >
            <ChevronLeft size={14} className="text-gray-500" />
            <span>{backLabel}</span>
          </button>
        ) : null}

        {!isReadOnly && showSave && onSave && (
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white shadow-xs transition-all hover:bg-[#B5151B] disabled:opacity-50 active:scale-[0.98]"
          >
            {saving ? (
              <span className="flex items-center gap-1.5">
                <span className="inline-block animate-spin rounded-full border-2 border-white border-t-transparent w-3.5 h-3.5" />
                <span>{savingText}</span>
              </span>
            ) : (
              <>
                <Save size={14} />
                <span>{saveLabel}</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
