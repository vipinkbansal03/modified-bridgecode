"use client";

import { useState, useRef, type ReactNode } from "react";
import { GripVertical } from "lucide-react";
import { cn } from "@/utils/cn";

export interface SortableListProps<T extends { id: string }> {
  items: T[];
  onReorder: (items: T[]) => void;
  renderItem: (item: T, index: number) => ReactNode;
  disabled?: boolean;
  className?: string;
  rowWidthClassName?: string;
  contentClassName?: string;
  itemClassName?: string;
  handleAriaLabel?: string;
}

export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  renderItem,
  disabled = false,
  className,
  rowWidthClassName = "w-max min-w-max",
  contentClassName = "min-w-max flex-none py-2 pr-3",
  itemClassName,
  handleAriaLabel = "Drag to reorder",
}: SortableListProps<T>) {
  const draggingIdRef = useRef<string | null>(null);
  const draggedElementRef = useRef<HTMLElement | null>(null);

  const clearDragStyles = () => {
    if (draggedElementRef.current) {
      draggedElementRef.current.classList.remove("opacity-50");
      draggedElementRef.current = null;
    }
  };

  const moveItem = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    const fromIndex = items.findIndex((item) => item.id === fromId);
    const toIndex = items.findIndex((item) => item.id === toId);
    if (fromIndex < 0 || toIndex < 0) return;
    const next = [...items];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    onReorder(next);
  };

  return (
    <div className={cn("space-y-2 min-w-max", className)}>
      {items.map((item, index) => (
        <div
          key={item.id}
          draggable={!disabled}
          onDragStart={(e) => {
            clearDragStyles();
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", item.id);
            draggingIdRef.current = item.id;
            draggedElementRef.current = e.currentTarget;
            const el = e.currentTarget;
            setTimeout(() => {
              if (draggingIdRef.current) {
                el.classList.add("opacity-50");
              }
            }, 0);
          }}
          onDragEnd={() => {
            clearDragStyles();
            draggingIdRef.current = null;
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            if (draggingIdRef.current && draggingIdRef.current !== item.id) {
              e.currentTarget.classList.add("border-[#E31E24]", "shadow-sm");
            }
          }}
          onDragLeave={(e) => {
            e.currentTarget.classList.remove("border-[#E31E24]", "shadow-sm");
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.classList.remove("border-[#E31E24]", "shadow-sm");
            const fromId = draggingIdRef.current || e.dataTransfer.getData("text/plain");
            clearDragStyles();
            draggingIdRef.current = null;
            if (fromId && fromId !== item.id) moveItem(fromId, item.id);
          }}
          className={cn(
            "flex items-stretch gap-2 rounded-lg border bg-white transition-shadow",
            rowWidthClassName,
            disabled ? "border-[#E6E6E6]" : "border-[#E6E6E6]",
            itemClassName,
          )}
        >
          {!disabled && (
            <div
              aria-label={handleAriaLabel}
              className="flex shrink-0 items-center px-1.5 text-[#9A9A9A] cursor-grab active:cursor-grabbing hover:text-[#1A1A1A] select-none"
            >
              <GripVertical size={16} />
            </div>
          )}
          <div className={cn(contentClassName, disabled && "pl-3")}>{renderItem(item, index)}</div>
        </div>
      ))}
    </div>
  );
}

export function toSortOrderPayload<T extends { id: string }>(items: T[]) {
  return items.map((item, sortOrder) => ({ id: item.id, sortOrder }));
}
