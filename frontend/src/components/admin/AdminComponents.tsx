"use client";

import { useState, useEffect, useLayoutEffect, useCallback, useRef, createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2, XCircle, Info, Check } from "lucide-react";
import { cn } from "@/utils/cn";
import { adminApi } from "@/services/adminApi";
import { ToastProvider, useToast as useSharedToast } from "@/components/ui/ToastProvider";

// ─── DataTable ────────────────────────────────────────────

export interface Column<T> {
  key: keyof T | string;
  label: React.ReactNode;
  width?: string;
  render?: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  rowKey: keyof T;
}

export function DataTable<T>({ columns, data, isLoading, emptyMessage = "No records found.", rowKey }: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="rounded-lg border border-[#E6E6E6] bg-white overflow-hidden">
        <div className="divide-y divide-[#E6E6E6]">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-4 px-4 py-3.5">
              {columns.map((_, j) => (
                <div key={j} className="h-4 flex-1 animate-pulse rounded bg-[#E6E6E6]" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#E6E6E6] bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#F8F8F8] border-b border-[#E6E6E6]">
            <tr>
              {columns.map((col) => (
                <th key={String(col.key)} className="px-4 py-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-[#9A9A9A]" style={{ width: col.width }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E6E6E6]">
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-[#9A9A9A] text-[13.5px]">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row) => (
                <tr key={String(row[rowKey])} className="hover:bg-[#FAFAFA] transition-colors">
                  {columns.map((col) => (
                    <td key={String(col.key)} className="px-4 py-3 text-[13.5px] text-[#1A1A1A]">
                      {col.render ? col.render(row) : String((row as Record<string, unknown>)[String(col.key)] ?? "")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-2 pt-4">
      <button disabled={page <= 1} onClick={() => onPageChange(page - 1)} className="flex items-center gap-1 rounded border border-[#E6E6E6] px-2.5 py-1.5 text-[13px] disabled:opacity-40 hover:bg-[#F2F2F2]">
        <ChevronLeft size={14} /> Prev
      </button>
      <span className="text-[13px] text-[#6B6B6B]">Page {page} of {totalPages}</span>
      <button disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} className="flex items-center gap-1 rounded border border-[#E6E6E6] px-2.5 py-1.5 text-[13px] disabled:opacity-40 hover:bg-[#F2F2F2]">
        Next <ChevronRight size={14} />
      </button>
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: "bg-green-50 text-green-700 border-green-200",
  SCHEDULED: "bg-blue-50 text-blue-700 border-blue-200",
  EXPIRED: "bg-amber-50 text-amber-700 border-amber-200",
  DRAFT: "bg-yellow-50 text-yellow-700 border-yellow-200",
  INACTIVE: "bg-gray-50 text-gray-600 border-gray-200",
  ARCHIVED: "bg-gray-100 text-gray-500 border-gray-200",
  IN_STOCK: "bg-green-50 text-green-700 border-green-200",
  LOW_STOCK: "bg-orange-50 text-orange-700 border-orange-200",
  OUT_OF_STOCK: "bg-red-50 text-red-700 border-red-200",
  BACKORDER: "bg-blue-50 text-blue-700 border-blue-200",
  PENDING: "bg-yellow-50 text-yellow-700 border-yellow-200",
  CONFIRMED: "bg-blue-50 text-blue-700 border-blue-200",
  SHIPPED: "bg-indigo-50 text-indigo-700 border-indigo-200",
  DELIVERED: "bg-green-50 text-green-700 border-green-200",
  CANCELLED: "bg-red-50 text-red-700 border-red-200",
  PAID: "bg-green-50 text-green-700 border-green-200",
  FAILED: "bg-red-50 text-red-700 border-red-200",
  REFUNDED: "bg-purple-50 text-purple-700 border-purple-200",
  CONVERTED: "bg-indigo-50 text-indigo-700 border-indigo-200",
  PENDING_REVIEW: "bg-amber-50 text-amber-700 border-amber-200",
  APPROVED: "bg-green-50 text-green-700 border-green-200",
  REJECTED: "bg-red-50 text-red-700 border-red-200",
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || "bg-gray-50 text-gray-600 border-gray-200";
  return (
    <span className={cn("inline-flex w-fit shrink-0 items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium", style)}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

// ─── Confirm Modal ────────────────────────────────────────

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  danger?: boolean;
}

export function ConfirmModal({ open, title, message, onConfirm, onCancel, isLoading, danger = true }: ConfirmModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => {
      clearTimeout(timer);
      setMounted(false);
    };
  }, []);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-[400px] rounded-xl bg-white p-6 shadow-xl">
        <div className="flex items-start gap-3 mb-4">
          {danger && <AlertTriangle size={20} className="flex-none text-red-500 mt-0.5" />}
          <div>
            <h3 className="text-[16px] font-semibold text-[#1A1A1A]">{title}</h3>
            <p className="mt-1 text-[13.5px] text-[#6B6B6B]">{message}</p>
          </div>
        </div>
        <div className="flex gap-2.5 justify-end">
          <button onClick={onCancel} className="rounded-md border border-[#E6E6E6] px-4 py-2 text-[13.5px] font-medium hover:bg-[#F2F2F2]">Cancel</button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={cn("rounded-md px-4 py-2 text-[13.5px] font-medium text-white disabled:opacity-50", danger ? "bg-red-600 hover:bg-red-700" : "bg-[#E31E24] hover:bg-[#B5151B]")}
          >
            {isLoading ? "Deleting…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── AdminInput ───────────────────────────────────────────

interface AdminInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function AdminInput({ label, error, className, ...props }: AdminInputProps) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-[13px] font-medium text-[#1A1A1A]">{label}</label>}
      <input
        {...props}
        className={cn(
          "w-full rounded-md border bg-white px-3.5 py-2.5 text-[14px] text-[#1A1A1A] outline-none transition-colors placeholder:text-[#9A9A9A]",
          error ? "border-red-400 focus:border-red-500" : "border-[#E6E6E6] focus:border-[#E31E24]",
          className
        )}
      />
      {error && <p className="text-[12px] text-red-500">{error}</p>}
    </div>
  );
}

// ─── AdminSelect ──────────────────────────────────────────

interface AdminSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export function AdminSelect({ label, error, options, className, ...props }: AdminSelectProps) {
  const { value, defaultValue, onChange, onBlur, disabled, name, id } = props;
  const [isOpen, setIsOpen] = useState(false);
  const [internalValue, setInternalValue] = useState(String(defaultValue ?? ""));
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuStyle, setMenuStyle] = useState<{ top?: number; bottom?: number; left: number; width: number; maxHeight: number } | null>(null);
  const selectedValue = String(value ?? internalValue ?? "");
  const selectedOption = options.find((option) => option.value === selectedValue);

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
    const longestLabel = options.reduce((max, option) => Math.max(max, option.label.length), 0);
    const contentMinWidth = Math.min(320, Math.max(168, longestLabel * 8 + 48));
    const width = Math.max(rect.width, contentMinWidth);
    const left = Math.max(edge, Math.min(rect.left, viewportWidth - width - edge));
    
    if (openUp) {
      const bottom = viewportHeight - rect.top + gap;
      setMenuStyle({ bottom, left, width, maxHeight });
    } else {
      const top = rect.bottom + gap;
      setMenuStyle({ top, left, width, maxHeight });
    }
  }, [options]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current && !rootRef.current.contains(target) && menuRef.current && !menuRef.current.contains(target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useLayoutEffect(() => {
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

    if (onChange) {
      onChange({
        target: { value: nextValue, name },
        currentTarget: { value: nextValue, name },
      } as React.ChangeEvent<HTMLSelectElement>);
    }
  };

  return (
    <div ref={rootRef} className="relative w-full min-w-[10rem] space-y-1.5">
      {label && <label className="block text-[13px] font-medium text-[#1A1A1A]">{label}</label>}
      <input type="hidden" name={name} value={selectedValue} />
      <button
        ref={buttonRef}
        id={id}
        type="button"
        disabled={disabled}
        onBlur={onBlur as unknown as React.FocusEventHandler<HTMLButtonElement>}
        onClick={() => setIsOpen((current) => !current)}
        className={cn(
          "flex w-full cursor-pointer items-center justify-between gap-3 rounded-md border bg-white px-3.5 py-2.5 text-left text-[14px] text-[#1A1A1A] outline-none transition disabled:cursor-not-allowed disabled:opacity-50",
          error ? "border-red-400" : "border-[#E6E6E6] focus:border-[#E31E24]",
          className,
        )}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={cn("truncate", !selectedOption && "text-[#9A9A9A]")}>
          {selectedOption?.label ?? options[0]?.label ?? "Select"}
        </span>
        <ChevronDown size={15} className={cn("shrink-0 text-[#9A9A9A] transition", isOpen && "rotate-180")} />
      </button>
      {isOpen && menuStyle && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              role="listbox"
              className="z-[10000] origin-top animate-admin-select-dropdown overflow-y-auto rounded-md border border-[#E6E6E6] bg-white py-1 shadow-lg"
              style={{
                position: "fixed",
                top: menuStyle.top !== undefined ? menuStyle.top : "auto",
                bottom: menuStyle.bottom !== undefined ? menuStyle.bottom : "auto",
                left: menuStyle.left,
                width: menuStyle.width,
                maxHeight: menuStyle.maxHeight,
              }}
            >
              {options.map((option) => (
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
            </div>,
            document.body,
          )
        : null}
      {error && <p className="text-[12px] text-red-500">{error}</p>}
    </div>
  );
}

// ─── AdminMultiSelect ──────────────────────────────────────

interface AdminMultiSelectProps {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  selectedValues?: string[];
  value?: string[];
  onChange: (nextValues: string[]) => void;
  placeholder?: string;
  className?: string;
  selectAllLabel?: string;
}

export function AdminMultiSelect({
  label,
  error,
  options,
  selectedValues,
  value,
  onChange,
  placeholder = "Select...",
  className,
  selectAllLabel,
}: AdminMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuStyle, setMenuStyle] = useState<{ top?: number; bottom?: number; left: number; width: number; maxHeight: number } | null>(null);

  const currentValues = value || selectedValues || [];

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
    const width = rect.width;
    const left = rect.left;

    if (openUp) {
      const bottom = viewportHeight - rect.top + gap;
      setMenuStyle({ bottom, left, width, maxHeight });
    } else {
      const top = rect.bottom + gap;
      setMenuStyle({ top, left, width, maxHeight });
    }
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        rootRef.current &&
        !rootRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useLayoutEffect(() => {
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

  const toggleOption = (val: string) => {
    const next = currentValues.includes(val)
      ? currentValues.filter((v) => v !== val)
      : [...currentValues, val];
    onChange(next);
  };

  const displayedText = currentValues.length > 0
    ? options
        .filter((o) => currentValues.includes(o.value))
        .map((o) => o.label)
        .join(", ")
    : placeholder;

  const allSelected = options.every((o) => currentValues.includes(o.value));

  return (
    <div ref={rootRef} className="relative w-full min-w-[10rem] space-y-1.5">
      {label && <label className="block text-[13px] font-medium text-[#1A1A1A]">{label}</label>}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((c) => !c)}
        className={cn(
          "flex w-full cursor-pointer items-center justify-between gap-3 rounded-md border bg-white px-3.5 py-2.5 text-left text-[14px] text-[#1A1A1A] outline-none transition",
          error ? "border-red-400" : "border-[#E6E6E6] focus:border-[#E31E24]",
          className
        )}
      >
        <span className={cn("truncate", currentValues.length === 0 && "text-[#9A9A9A]")}>
          {displayedText}
        </span>
        <ChevronDown size={15} className={cn("shrink-0 text-[#9A9A9A] transition", isOpen && "rotate-180")} />
      </button>

      {isOpen && menuStyle && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              className="z-[10000] origin-top overflow-y-auto rounded-md border border-[#E6E6E6] bg-white shadow-lg flex flex-col"
              style={{
                position: "fixed",
                top: menuStyle.top !== undefined ? menuStyle.top : "auto",
                bottom: menuStyle.bottom !== undefined ? menuStyle.bottom : "auto",
                left: menuStyle.left,
                width: menuStyle.width,
                maxHeight: menuStyle.maxHeight,
              }}
            >
              {options.length > 1 && (
                <div className="flex items-center justify-between border-b border-[#F0F0F0] px-3.5 py-1.5 bg-[#FAF9F9] shrink-0 sticky top-0 z-10">
                  <button
                    type="button"
                    onClick={() => {
                      if (allSelected) {
                        onChange([]);
                      } else {
                        onChange(options.map((o) => o.value));
                      }
                    }}
                    className="text-xs font-semibold text-[#E31E24] hover:text-[#B5151B] transition cursor-pointer select-none"
                  >
                    {selectAllLabel || (allSelected ? "Deselect All" : "Select All")}
                  </button>
                </div>
              )}
              <div className="py-1 flex flex-col space-y-0.5">
                {options.map((option) => {
                  const isSelected = currentValues.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => toggleOption(option.value)}
                      className={cn(
                        "w-full cursor-pointer px-3.5 py-2 text-left text-[13.5px] transition flex items-center gap-2.5",
                        isSelected ? "bg-red-50" : "hover:bg-[#F7F7F7]"
                      )}
                    >
                      <div className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                        isSelected ? "border-[#E31E24] bg-[#E31E24]" : "border-[#D1D5DB] bg-white"
                      )}>
                        {isSelected && <svg width="10" height="8" viewBox="0 0 10 8" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                      <span className={cn("truncate", isSelected ? "text-[#E31E24] font-medium" : "text-[#1A1A1A]")}>
                        {option.label}
                      </span>
                    </button>
                  );
                })}
              </div>
              {options.length === 0 && (
                <div className="px-3.5 py-2 text-xs text-[#9A9A9A] text-center">
                  No options available.
                </div>
              )}
            </div>,
            document.body
          )
        : null}
      {error && <p className="text-[12px] text-red-500">{error}</p>}
    </div>
  );
}

// ─── AdminTextarea ────────────────────────────────────────

interface AdminTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function AdminTextarea({ label, error, className, ...props }: AdminTextareaProps) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-[13px] font-medium text-[#1A1A1A]">{label}</label>}
      <textarea {...props} className={cn("w-full rounded-md border bg-white px-3.5 py-2.5 text-[14px] text-[#1A1A1A] outline-none resize-y", error ? "border-red-400" : "border-[#E6E6E6] focus:border-[#E31E24]", className)} />
      {error && <p className="text-[12px] text-red-500">{error}</p>}
    </div>
  );
}

function sanitizeRichText(html: string) {
  if (typeof window === "undefined") return html;
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const allowedTags = new Set(["B", "STRONG", "I", "EM", "U", "P", "BR", "DIV", "SPAN", "UL", "OL", "LI", "A", "H1", "H2", "H3", "BLOCKQUOTE", "PRE", "CODE", "IMG", "FIGURE", "FIGCAPTION", "BUTTON"]);
  const allowedAttrs = new Set(["href", "target", "rel", "src", "alt", "width", "height", "class", "style", "contenteditable", "onclick", "title"]);

  function clean(node: ChildNode) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (!allowedTags.has(el.tagName)) {
        const fragment = document.createDocumentFragment();
        while (el.firstChild) {
          fragment.appendChild(el.firstChild);
        }
        el.replaceWith(fragment);
        return;
      }

      for (const attr of Array.from(el.attributes)) {
        if (!allowedAttrs.has(attr.name)) {
          el.removeAttribute(attr.name);
          continue;
        }
        if (attr.name === "href") {
          if (!/^([a-zA-Z][a-zA-Z0-9+.-]*:|\/\/|mailto:)/.test(attr.value)) {
            el.removeAttribute("href");
          } else {
            el.setAttribute("target", "_blank");
            el.setAttribute("rel", "noopener noreferrer");
          }
        }
      }
    }

    node.childNodes.forEach(clean);
  }

  doc.body.childNodes.forEach(clean);
  return doc.body.innerHTML;
}

interface AdminRichTextEditorProps {
  label?: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  error?: string;
  className?: string;
}

export function AdminRichTextEditor({ label, value, onChange, placeholder, error, className }: AdminRichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
      // Ensure all images inside editor have a cross (X) delete button
      const imgs = editorRef.current.querySelectorAll("img");
      imgs.forEach((img) => {
        if (!img.parentElement?.classList.contains("img-wrapper")) {
          const wrapper = document.createElement("span");
          wrapper.className = "img-wrapper relative inline-block my-2 mr-3 align-bottom group select-none";
          wrapper.setAttribute("contenteditable", "false");

          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "img-delete-btn absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#E31E24] text-white text-[11px] font-bold shadow-md hover:bg-[#B5151B] transition-transform hover:scale-110 cursor-pointer";
          btn.title = "Remove image";
          btn.innerHTML = "✕";

          img.parentNode?.insertBefore(wrapper, img);
          wrapper.appendChild(img);
          wrapper.appendChild(btn);
        }
      });
    }
  }, [value]);

  const updateValue = () => {
    if (!editorRef.current) return;
    onChange(sanitizeRichText(editorRef.current.innerHTML));
  };

  const saveCursorLocation = () => {
    if (typeof window === "undefined") return;
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current && editorRef.current.contains(sel.anchorNode)) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
  };

  const applyFormat = (command: string, option?: string) => {
    document.execCommand(command, false, option || "");
    updateValue();
    editorRef.current?.focus();
  };

  const insertHtmlAtSavedCursor = (html: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();

    const sel = window.getSelection();
    let range: Range | null = null;

    if (savedRangeRef.current && editorRef.current.contains(savedRangeRef.current.commonAncestorContainer)) {
      range = savedRangeRef.current;
    } else if (sel && sel.rangeCount > 0 && editorRef.current.contains(sel.anchorNode)) {
      range = sel.getRangeAt(0);
    }

    if (range && sel) {
      sel.removeAllRanges();
      sel.addRange(range);
      range.deleteContents();

      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = html;
      const frag = document.createDocumentFragment();
      let node;
      let lastNode;
      while ((node = tempDiv.firstChild)) {
        lastNode = frag.appendChild(node);
      }
      range.insertNode(frag);
      if (lastNode) {
        range.setStartAfter(lastNode);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    } else {
      editorRef.current.innerHTML += html;
    }
    savedRangeRef.current = null;
    updateValue();
  };

  const handleEditorClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const deleteBtn = target.closest(".img-delete-btn");
    if (deleteBtn) {
      e.preventDefault();
      e.stopPropagation();
      const wrapper = deleteBtn.closest(".img-wrapper") || deleteBtn.parentElement;
      if (wrapper && editorRef.current?.contains(wrapper)) {
        wrapper.remove();
      } else {
        deleteBtn.remove();
      }
      updateValue();
    }
  };

  const handleInsertImageFile = async (file: File) => {
    setUploadingImg(true);
    try {
      const formData = new FormData();
      formData.append("files", file);
      const res = await adminApi.post("/media", formData);
      const mediaItem = Array.isArray(res.data?.data) ? res.data.data[0] : res.data?.data || res.data;
      const url = mediaItem?.url || mediaItem?.location || (typeof mediaItem === "string" ? mediaItem : "");
      if (url) {
        const cleanImgHtml = `<span class="img-wrapper relative inline-block my-2 mr-3 align-bottom group select-none" contenteditable="false"><img src="${url}" alt="Product Image" class="max-h-48 max-w-full w-auto inline-block rounded-lg border border-[#E5E7EB] bg-white p-1.5 shadow-2xs" /><button type="button" class="img-delete-btn absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#E31E24] text-white text-[11px] font-bold shadow-md hover:bg-[#B5151B] transition-transform hover:scale-110 cursor-pointer" title="Remove image">✕</button></span><p><br></p>`;
        insertHtmlAtSavedCursor(cleanImgHtml);
      } else {
        alert("Failed to get uploaded media URL.");
      }
    } catch (err) {
      console.error("Image upload failed", err);
      alert("Image upload failed. Please make sure you are logged in.");
    } finally {
      setUploadingImg(false);
    }
  };

  return (
    <div className="space-y-1.5">
      {label && <label className="block text-[13px] font-medium text-[#1A1A1A]">{label}</label>}
      <div className={cn("rounded-md border bg-white", error ? "border-red-400" : "border-[#E6E6E6] focus-within:border-[#E31E24]", className)}>
        <div className="flex flex-wrap gap-1 border-b border-[#E6E6E6] bg-[#FAFAFA] px-2 py-2">
          <button type="button" title="Bold" className="rounded px-2 py-1 text-[13px] text-[#1A1A1A] hover:bg-[#F2F2F2]" onClick={() => applyFormat("bold")}>
            B
          </button>
          <button type="button" title="Italic" className="rounded px-2 py-1 text-[13px] text-[#1A1A1A] hover:bg-[#F2F2F2]" onClick={() => applyFormat("italic")}>
            I
          </button>
          <button type="button" title="Underline" className="rounded px-2 py-1 text-[13px] text-[#1A1A1A] hover:bg-[#F2F2F2]" onClick={() => applyFormat("underline")}>
            U
          </button>
          <button type="button" title="Strike" className="rounded px-2 py-1 text-[13px] text-[#1A1A1A] hover:bg-[#F2F2F2]" onClick={() => applyFormat("strikeThrough")}>
            S
          </button>
          <button type="button" title="Link" className="rounded px-2 py-1 text-[13px] text-[#1A1A1A] hover:bg-[#F2F2F2]" onClick={() => {
            const url = window.prompt("Enter link URL:", "https://");
            if (url) applyFormat("createLink", url);
          }}>
            Link
          </button>

          {/* Direct Image Upload Button in Editor Toolbar */}
          <button
            type="button"
            title="Attach/Insert Image"
            className="flex items-center gap-1 rounded bg-[#E31E24]/10 px-2 py-1 text-[12px] font-bold text-[#E31E24] hover:bg-[#E31E24]/20"
            onClick={() => {
              saveCursorLocation();
              fileInputRef.current?.click();
            }}
            disabled={uploadingImg}
          >
            🖼️ {uploadingImg ? "Uploading..." : "Image"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleInsertImageFile(file);
              e.target.value = "";
            }}
          />
          <button type="button" title="Unordered list" className="rounded px-2 py-1 text-[13px] text-[#1A1A1A] hover:bg-[#F2F2F2]" onClick={() => applyFormat("insertUnorderedList")}>
            • List
          </button>
          <button type="button" title="Ordered list" className="rounded px-2 py-1 text-[13px] text-[#1A1A1A] hover:bg-[#F2F2F2]" onClick={() => applyFormat("insertOrderedList")}>
            1. List
          </button>
          <button type="button" title="Blockquote" className="rounded px-2 py-1 text-[13px] text-[#1A1A1A] hover:bg-[#F2F2F2]" onClick={() => applyFormat("formatBlock", "blockquote")}>
            {"\""}
          </button>
          <button type="button" title="Code block" className="rounded px-2 py-1 text-[13px] text-[#1A1A1A] hover:bg-[#F2F2F2]" onClick={() => applyFormat("formatBlock", "pre")}>
            {'</>'}
          </button>
          <button type="button" title="Heading 2" className="rounded px-2 py-1 text-[13px] text-[#1A1A1A] hover:bg-[#F2F2F2]" onClick={() => applyFormat("formatBlock", "h2")}>
            H2
          </button>
          <button type="button" title="Heading 3" className="rounded px-2 py-1 text-[13px] text-[#1A1A1A] hover:bg-[#F2F2F2]" onClick={() => applyFormat("formatBlock", "h3")}>
            H3
          </button>
          <button type="button" title="Align left" className="rounded px-2 py-1 text-[13px] text-[#1A1A1A] hover:bg-[#F2F2F2]" onClick={() => applyFormat("justifyLeft")}>
            L
          </button>
          <button type="button" title="Align center" className="rounded px-2 py-1 text-[13px] text-[#1A1A1A] hover:bg-[#F2F2F2]" onClick={() => applyFormat("justifyCenter")}>
            C
          </button>
          <button type="button" title="Align right" className="rounded px-2 py-1 text-[13px] text-[#1A1A1A] hover:bg-[#F2F2F2]" onClick={() => applyFormat("justifyRight")}>
            R
          </button>
          <button type="button" title="Undo" className="rounded px-2 py-1 text-[13px] text-[#1A1A1A] hover:bg-[#F2F2F2]" onClick={() => applyFormat("undo")}>
            ↺
          </button>
          <button type="button" title="Redo" className="rounded px-2 py-1 text-[13px] text-[#1A1A1A] hover:bg-[#F2F2F2]" onClick={() => applyFormat("redo")}>
            ↻
          </button>
          <button type="button" title="Remove formatting" className="rounded px-2 py-1 text-[13px] text-[#1A1A1A] hover:bg-[#F2F2F2]" onClick={() => applyFormat("removeFormat")}>
            Clear
          </button>
        </div>
        <div className="relative">
          {!value && !isFocused ? (
            <div className="pointer-events-none absolute inset-0 px-3 py-3 text-[14px] text-[#9A9A9A]">{placeholder}</div>
          ) : null}
          <div
            ref={editorRef}
            contentEditable
            role="textbox"
            aria-multiline="true"
            suppressContentEditableWarning
            onClick={handleEditorClick}
            onInput={() => {
              saveCursorLocation();
              updateValue();
            }}
            onKeyUp={saveCursorLocation}
            onMouseUp={saveCursorLocation}
            onBlur={() => {
              saveCursorLocation();
              setIsFocused(false);
              updateValue();
            }}
            onFocus={() => setIsFocused(true)}
            className="min-h-[120px] w-full rounded-b-md bg-white px-3 py-3 text-[14px] leading-6 text-[#1A1A1A] outline-none"
          />
        </div>
      </div>
      {error && <p className="text-[12px] text-red-500">{error}</p>}
    </div>
  );
}

// ─── StatCard ─────────────────────────────────────────────

interface StatCardProps {
  title: string;
  value: React.ReactNode;
  subtitle?: string;
  icon: ReactNode;
  color?: string;
  isLoading?: boolean;
}

export function StatCard({ title, value, subtitle, icon, color = "bg-[#E31E24]", isLoading }: StatCardProps) {
  const isLongString = typeof value === "string" && value.length > 12;
  return (
    <div className="rounded-xl bg-white border border-[#E6E6E6] p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[12.5px] font-medium uppercase tracking-wide text-[#9A9A9A]">{title}</div>
          {isLoading ? (
            <div className="mt-2 h-7 w-20 animate-pulse rounded bg-[#E6E6E6]" />
          ) : (
            <div className={cn("mt-1.5 font-bold text-[#1A1A1A]", isLongString ? "text-[18px]" : "text-[26px]")}>{value}</div>
          )}
          {subtitle && <div className="mt-1 text-[12px] text-[#9A9A9A]">{subtitle}</div>}
        </div>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg text-white", color)}>
          {icon}
        </div>
      </div>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────

export type { ToastType } from "@/components/ui/ToastProvider";

export const toastMessages = {
  saved: "Changes saved successfully.",
  translationSaved: "Translation saved successfully.",
  staticLabelSaved: "UI label updated successfully.",
  noChanges: "No changes to save.",
  saveFailed: "Could not save changes. Please try again.",
  translationFailed: "Could not save translation. Please try again.",
  approved: "Translation approved and published.",
  rejected: "Translation rejected.",
} as const;

export function AdminToastProvider({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}

export function useToast() {
  const shared = useSharedToast();
  return { showToast: shared.showToast, ToastComponent: null as ReactNode };
}


