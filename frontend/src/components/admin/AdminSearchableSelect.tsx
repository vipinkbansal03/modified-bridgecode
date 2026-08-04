"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/utils/cn";
import { ChevronDown, Search } from "lucide-react";

interface AdminSearchableSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  showSearch?: boolean;
  searchFields?: string[];
  // New props for infinite scroll
  onMenuScrollToBottom?: () => void;
  isLoadingMore?: boolean;
  onSearchChange?: (query: string) => void;
  isInfinite?: boolean;
}

export function AdminSearchableSelect({
  label,
  error,
  options,
  placeholder = "Select",
  searchPlaceholder = "Search...",
  className,
  showSearch = true,
  searchFields = ["label"],
  value,
  defaultValue,
  onChange,
  onBlur,
  disabled,
  name,
  id,
  // Infinite scroll / paging props
  onMenuScrollToBottom,
  isLoadingMore = false,
  onSearchChange,
  isInfinite = false,
  ...props
}: AdminSearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(String(defaultValue ?? ""));
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(20);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [menuStyle, setMenuStyle] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  const selectedValue = String(value ?? internalValue ?? "");
  const selectedOption = options.find((option) => option.value === selectedValue);

  const filteredOptions = useMemo(() => {
    if (!showSearch || !searchQuery.trim() || onSearchChange) return options;
    const query = searchQuery.toLowerCase().trim();
    return options.filter((option) =>
      searchFields.some((field) => {
        const fieldValue = field === "label" ? option.label : field === "value" ? option.value : "";
        return fieldValue.toLowerCase().includes(query);
      })
    );
  }, [options, searchQuery, showSearch, searchFields, onSearchChange]);

  const displayedOptions = useMemo(() => {
    if (isInfinite && !onMenuScrollToBottom) {
      return filteredOptions.slice(0, visibleCount);
    }
    return filteredOptions;
  }, [filteredOptions, isInfinite, onMenuScrollToBottom, visibleCount]);

  useEffect(() => {
    setVisibleCount(20);
    if (onSearchChange) {
      onSearchChange(searchQuery);
    }
  }, [searchQuery, onSearchChange]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollHeight - target.scrollTop <= target.clientHeight + 25) {
      if (onMenuScrollToBottom) {
        onMenuScrollToBottom();
      } else if (isInfinite && visibleCount < filteredOptions.length) {
        setVisibleCount((prev) => prev + 20);
      }
    }
  };

  const updateMenuPosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const gap = 6;
    const edge = 12;
    const spaceBelow = viewportHeight - rect.bottom - gap - edge;
    const spaceAbove = rect.top - gap - edge;
    const openUp = spaceBelow < 180 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(160, Math.min(320, openUp ? spaceAbove : spaceBelow));
    const longestLabel = displayedOptions.reduce((max, option) => Math.max(max, option.label.length), 0);
    const contentMinWidth = Math.min(320, Math.max(168, longestLabel * 8 + 48));
    const width = Math.max(rect.width, contentMinWidth);
    const left = Math.max(edge, Math.min(rect.left, viewportWidth - width - edge));

    setMenuStyle((prev) => {
      const top = openUp ? undefined : rect.bottom + gap;
      const bottom = openUp ? viewportHeight - rect.top + gap : undefined;

      if (
        prev &&
        prev.top === top &&
        prev.bottom === bottom &&
        prev.left === left &&
        prev.width === width &&
        prev.maxHeight === maxHeight
      ) {
        return prev;
      }
      return openUp ? { bottom, left, width, maxHeight } : { top, left, width, maxHeight };
    });
  }, [displayedOptions]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current && !rootRef.current.contains(target) && menuRef.current && !menuRef.current.contains(target)) {
        setIsOpen(false);
        setSearchQuery("");
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen) updateMenuPosition();
  }, [isOpen, updateMenuPosition]);

  useEffect(() => {
    if (!isOpen) return;
    const handleReflow = () => updateMenuPosition();
    window.addEventListener("resize", handleReflow);
    window.addEventListener("scroll", handleReflow, true);
    return () => {
      window.removeEventListener("resize", handleReflow);
      window.removeEventListener("scroll", handleReflow, true);
    };
  }, [isOpen, updateMenuPosition]);

  const selectOption = (nextValue: string) => {
    setInternalValue(nextValue);
    setIsOpen(false);
    setSearchQuery("");

    if (onChange) {
      onChange({
        target: { value: nextValue, name },
        currentTarget: { value: nextValue, name },
      } as React.ChangeEvent<HTMLSelectElement>);
    }
  };

  useEffect(() => {
    if (isOpen && menuStyle) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 10);
      return () => clearTimeout(timer);
    }
  }, [isOpen, menuStyle]);

  return (
    <div ref={rootRef} className={cn("relative w-full min-w-[10rem] space-y-1.5", className)}>
      {label && <label className="block text-[13px] font-medium text-[#1A1A1A]">{label}</label>}
      <input type="hidden" name={name} value={selectedValue} />
      <button
        ref={buttonRef}
        id={id}
        type="button"
        disabled={disabled}
        onBlur={onBlur as unknown as React.FocusEventHandler<HTMLButtonElement>}
        onClick={() => !disabled && setIsOpen((current) => !current)}
        className={cn(
          "flex w-full cursor-pointer items-center justify-between gap-3 rounded-md border bg-white px-3.5 py-2.5 text-left text-[14px] text-[#1A1A1A] outline-none transition disabled:cursor-not-allowed disabled:opacity-50",
          error ? "border-red-400" : "border-[#E6E6E6] focus:border-[#E31E24]",
          className,
        )}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={cn("truncate flex-1", !selectedOption && "text-[#9A9A9A]")}>
          {selectedOption?.label ?? placeholder}
        </span>
        <ChevronDown size={15} className={cn("shrink-0 text-[#9A9A9A] transition", isOpen && "rotate-180")} />
      </button>
      {isOpen && menuStyle && typeof document !== "undefined" ? createPortal(
        <div
          ref={menuRef}
          role="listbox"
          className="z-[10000] origin-top animate-admin-select-dropdown flex flex-col overflow-hidden rounded-md border border-[#E6E6E6] bg-white shadow-lg animate-in fade-in zoom-in-95 duration-100"
          style={{
            position: "fixed",
            top: menuStyle.top !== undefined ? menuStyle.top : "auto",
            bottom: menuStyle.bottom !== undefined ? menuStyle.bottom : "auto",
            left: menuStyle.left,
            width: menuStyle.width,
            maxHeight: menuStyle.maxHeight,
          }}
        >
          {showSearch && (
            <div className="sticky top-0 z-10 shrink-0 bg-white px-2 py-1.5 border-b border-[#E6E6E6]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9A9A]" />
              <input
                ref={inputRef}
                autoFocus
                type="text"
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setIsOpen(false);
                    setSearchQuery("");
                  }
                }}
                className="h-8 w-full rounded-md border border-[#E6E6E6] bg-white pl-8 pr-3 text-[13px] text-[#1A1A1A] outline-none focus:border-[#E31E24]"
              />
            </div>
          )}
          <div className="flex-1 overflow-y-auto py-1" onScroll={handleScroll}>
            {displayedOptions.length === 0 && !isLoadingMore ? (
              <div className="px-3.5 py-2 text-[13.5px] text-[#9A9A9A]">No options found</div>
            ) : (
              <>
                {displayedOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={option.value === selectedValue}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectOption(option.value)}
                    className={cn(
                      "w-full cursor-pointer whitespace-nowrap px-3.5 py-2 text-left text-[13.5px] transition hover:bg-[#F7F7F7]",
                      option.value === selectedValue ? "bg-red-50 text-[#E31E24]" : "text-[#1A1A1A]",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
                {isLoadingMore && (
                  <div className="flex items-center justify-center py-2.5">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#E31E24] border-t-transparent" />
                  </div>
                )}
              </>
            )}
          </div>
        </div>,
        document.body,
      ) : null}
      {error && <p className="text-[12px] text-red-500">{error}</p>}
    </div>
  );
}