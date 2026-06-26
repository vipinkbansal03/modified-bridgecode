"use client";

import { useState, type ReactNode } from "react";
import { GripVertical } from "lucide-react";
import { cn } from "@/utils/cn";

export interface SortableListProps<T extends { id: string }> {
  items: T[];
  onReorder: (items: T[]) => void;
  renderItem: (item: T, index: number) => ReactNode;
  disabled?: boolean;
  className?: string;
  itemClassName?: string;
  handleAriaLabel?: string;
}

export function SortableList<T extends { id: string }>({
  items,
  onReorder,
  renderItem,
  disabled = false,
  className,
  itemClassName,
  handleAriaLabel = "Drag to reorder",
}: SortableListProps<T>) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

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
    <div className={cn("space-y-2", className)}>
      {items.map((item, index) => (
        <div
          key={item.id}
          draggable={!disabled}
          onDragStart={() => setDraggingId(item.id)}
          onDragEnd={() => {
            setDraggingId(null);
            setOverId(null);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setOverId(item.id);
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (draggingId) moveItem(draggingId, item.id);
            setDraggingId(null);
            setOverId(null);
          }}
          className={cn(
            "flex items-stretch gap-2 rounded-lg border bg-white transition-shadow",
            draggingId === item.id && "opacity-50",
            overId === item.id && draggingId && draggingId !== item.id && "border-[#E31E24] shadow-sm",
            disabled ? "border-[#E6E6E6]" : "border-[#E6E6E6]",
            itemClassName,
          )}
        >
          <button
            type="button"
            aria-label={handleAriaLabel}
            className={cn(
              "flex shrink-0 items-center px-2 text-[#9A9A9A]",
              disabled ? "cursor-not-allowed opacity-40" : "cursor-grab active:cursor-grabbing hover:text-[#1A1A1A]",
            )}
            disabled={disabled}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <GripVertical size={16} />
          </button>
          <div className="min-w-0 flex-1 py-2 pr-3">{renderItem(item, index)}</div>
        </div>
      ))}
    </div>
  );
}

export function toSortOrderPayload<T extends { id: string }>(items: T[]) {
  return items.map((item, sortOrder) => ({ id: item.id, sortOrder }));
}
