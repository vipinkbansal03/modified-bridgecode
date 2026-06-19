"use client";

import { useState, ReactNode } from "react";
import { ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { cn } from "@/utils/cn";

// ─── DataTable ────────────────────────────────────────────

export interface Column<T> {
  key: keyof T | string;
  label: string;
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
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] || "bg-gray-50 text-gray-600 border-gray-200";
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium", style)}>
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
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
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
    </div>
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
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-[13px] font-medium text-[#1A1A1A]">{label}</label>}
      <select
        {...props}
        className={cn("w-full rounded-md border bg-white px-3.5 py-2.5 text-[14px] text-[#1A1A1A] outline-none", error ? "border-red-400" : "border-[#E6E6E6] focus:border-[#E31E24]", className)}
      >
        {options.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
      </select>
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

// ─── StatCard ─────────────────────────────────────────────

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  color?: string;
  isLoading?: boolean;
}

export function StatCard({ title, value, subtitle, icon, color = "bg-[#E31E24]", isLoading }: StatCardProps) {
  return (
    <div className="rounded-xl bg-white border border-[#E6E6E6] p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[12.5px] font-medium uppercase tracking-wide text-[#9A9A9A]">{title}</div>
          {isLoading ? (
            <div className="mt-2 h-7 w-20 animate-pulse rounded bg-[#E6E6E6]" />
          ) : (
            <div className="mt-1.5 text-[26px] font-bold text-[#1A1A1A]">{value}</div>
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
// Simple inline toast — for production use react-hot-toast or sonner

interface ToastState {
  message: string;
  type: "success" | "error";
}

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const ToastComponent = toast ? (
    <div className={cn("fixed bottom-5 right-5 z-50 rounded-lg px-5 py-3.5 text-[13.5px] font-medium text-white shadow-lg transition-all", toast.type === "success" ? "bg-[#1A1A1A]" : "bg-red-600")}>
      {toast.message}
    </div>
  ) : null;

  return { showToast, ToastComponent };
}
