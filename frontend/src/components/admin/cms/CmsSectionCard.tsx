"use client";

import { useState, type ReactNode, type DragEvent } from "react";
import { ChevronDown, GripVertical, HelpCircle, Lock } from "lucide-react";
import { CmsSectionToggle } from "./CmsSectionToggle";
import { cn } from "@/utils/cn";

interface CmsSectionCardProps {
  number?: number | string;
  title: string;
  subtitle?: string;
  description?: string;
  tooltip?: string;
  enabled?: boolean;
  onToggleEnabled?: (enabled: boolean) => void;
  isAlwaysActive?: boolean;
  canReorder?: boolean;
  isDraggable?: boolean;
  onDragStart?: (e: DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (e: DragEvent<HTMLDivElement>) => void;
  onDragOver?: (e: DragEvent<HTMLDivElement>) => void;
  onDrop?: (e: DragEvent<HTMLDivElement>) => void;
  isDragging?: boolean;
  isOver?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  defaultExpanded?: boolean;
  children: ReactNode;
  headerBadge?: ReactNode;
  className?: string;
}

export function CmsSectionCard({
  number,
  title,
  subtitle,
  description,
  tooltip,
  enabled = true,
  onToggleEnabled,
  isAlwaysActive = false,
  canReorder = false,
  isDraggable = false,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  isDragging = false,
  isOver = false,
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false,
  defaultExpanded = false, // Closed by default per user request
  children,
  headerBadge,
  className,
}: CmsSectionCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isHandleActive, setIsHandleActive] = useState(false);

  return (
    <div
      draggable={isDraggable && isHandleActive}
      onDragStart={(e) => {
        if (!isHandleActive) {
          e.preventDefault();
          return;
        }
        onDragStart?.(e);
      }}
      onDragEnd={(e) => {
        setIsHandleActive(false);
        onDragEnd?.(e);
      }}
      onDragOver={onDragOver}
      onDrop={(e) => {
        setIsHandleActive(false);
        onDrop?.(e);
      }}
      className={cn(
        "rounded-xl border bg-white transition-all shadow-xs overflow-hidden",
        isDragging && "opacity-50 scale-[0.99]",
        isOver && "border-[#E31E24] shadow-md ring-2 ring-red-100",
        !isOver && !isDragging && (enabled ? "border-[#E6E6E6]" : "border-gray-200 bg-gray-50/60 opacity-90"),
        className
      )}
    >
      {/* Header */}
      <div
        onClick={() => setIsExpanded((prev) => !prev)}
        className="flex cursor-pointer items-center justify-between gap-3 px-5 py-3.5 select-none hover:bg-gray-50/80 transition-colors border-b border-transparent data-[expanded=true]:border-[#F0F0F0]"
        data-expanded={isExpanded}
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Drag Handle */}
          {isDraggable && (
            <div
              className="flex shrink-0 items-center px-1 text-gray-400 hover:text-gray-700 cursor-grab active:cursor-grabbing p-1 rounded hover:bg-gray-100"
              title="Drag to reorder section"
              onClick={(e) => e.stopPropagation()}
              onMouseDown={() => setIsHandleActive(true)}
              onMouseUp={() => setIsHandleActive(false)}
              onMouseLeave={() => setIsHandleActive(false)}
            >
              <GripVertical size={16} />
            </div>
          )}

          {/* Up / Down Buttons as fallback */}
          {canReorder && (
            <div
              className="flex flex-col gap-0.5 text-gray-400 hover:text-gray-600"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                disabled={!canMoveUp}
                onClick={onMoveUp}
                className="p-0.5 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed text-[10px]"
                title="Move Section Up"
              >
                ▲
              </button>
              <button
                type="button"
                disabled={!canMoveDown}
                onClick={onMoveDown}
                className="p-0.5 hover:bg-gray-200 rounded disabled:opacity-30 disabled:cursor-not-allowed text-[10px]"
                title="Move Section Down"
              >
                ▼
              </button>
            </div>
          )}

          {number !== undefined && (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-50 text-[11.5px] font-bold text-[#E31E24]">
              {number}
            </span>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-[14.5px] font-semibold text-[#1A1A1A] tracking-tight truncate">
                {title}
              </h3>
              {headerBadge}
              {subtitle && (
                <span className="text-[11.5px] font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                  {subtitle}
                </span>
              )}
              {tooltip && (
                <span title={tooltip} className="text-gray-400 hover:text-gray-600">
                  <HelpCircle size={14} />
                </span>
              )}
            </div>
            {description && (
              <p className="mt-0.5 text-[12px] text-[#6B6B6B] line-clamp-1">
                {description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
          {isAlwaysActive ? (
            <span
              className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full select-none cursor-default"
              title="Required section — this section is always active and cannot be disabled"
            >
              <Lock size={11.5} className="text-emerald-600 shrink-0" />
              <span>Always Active</span>
            </span>
          ) : onToggleEnabled ? (
            <CmsSectionToggle enabled={enabled} onChange={onToggleEnabled} />
          ) : null}

          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100 transition-transform"
            aria-label={isExpanded ? "Collapse section" : "Expand section"}
          >
            <ChevronDown
              size={18}
              className={cn("transition-transform duration-200", isExpanded && "rotate-180")}
            />
          </button>
        </div>
      </div>

      {/* Body */}
      {isExpanded && (
        <div className="p-5 space-y-5 bg-white border-t border-[#F2F2F2]">
          {children}
        </div>
      )}
    </div>
  );
}
