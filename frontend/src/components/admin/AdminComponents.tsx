"use client";

import { useState, useEffect, useLayoutEffect, useCallback, useRef, createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  Check,
  Plus,
  GripVertical,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Link2,
  Unlink,
  Image as ImageIcon,
  List,
  ListOrdered,
  Quote,
  Code,
  Heading2,
  Heading3,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Undo2,
  Redo2,
  RemoveFormatting,
  Code2,
  Eye,
  X,
  ExternalLink,
  Upload,
  Globe,
  Loader2,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { adminApi } from "@/services/adminApi";
import { ToastProvider, useToast as useSharedToast } from "@/components/ui/ToastProvider";
export { Modal, type ModalProps } from "@/components/ui/Modal";

// ─── DataTable ────────────────────────────────────────────

export interface Column<T> {
  key: keyof T | string;
  label: React.ReactNode;
  width?: string;
  align?: "left" | "center" | "right";
  render?: (row: T) => ReactNode;
  enableStatusToggle?: boolean;
  getStatus?: (row: T) => string | boolean;
  isStatusLoading?: (row: T) => boolean;
  isStatusDisabled?: (row: T) => boolean;
  onToggleStatus?: (row: T) => void | Promise<void>;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  rowKey: keyof T;
  onRowClick?: (row: T) => void;
  rowTooltip?: string | ((row: T) => string);

  // Optional Selection configuration
  enableSelection?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;

  // Optional Reordering configuration
  enableReorder?: boolean;
  onReorder?: (items: T[]) => void;
  disabledReorder?: boolean;

  // Optional Status Toggle configuration
  onToggleStatus?: (row: T) => void | Promise<void>;
  statusLoadingId?: string | null;
  isStatusLoading?: (row: T) => boolean;
  isStatusDisabled?: (row: T) => boolean;

  // Optional Bulk Actions
  renderBulkActions?: (selectedIds: string[]) => React.ReactNode;

  // Optional Card Header configuration
  title?: React.ReactNode;
  description?: React.ReactNode;
  headerActions?: React.ReactNode;

  // Optional Pagination configuration for unified toolbar
  totalItems?: number;
  currentPage?: number;
  pageSize?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  onSelectAll?: (checked: boolean) => void | Promise<void>;
}

export function DataTable<T>({
  columns,
  data,
  isLoading,
  emptyMessage = "No records found.",
  rowKey,
  onRowClick,
  rowTooltip,
  enableSelection = false,
  selectedIds = [],
  onSelectionChange,
  enableReorder = false,
  onReorder,
  disabledReorder = false,
  onToggleStatus,
  statusLoadingId = null,
  isStatusLoading,
  isStatusDisabled,
  renderBulkActions,
  title,
  description,
  headerActions,
  totalItems,
  currentPage,
  pageSize,
  totalPages,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions,
  onSelectAll,
}: DataTableProps<T>) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

  const totalColumns = columns.length + (enableReorder ? 1 : 0) + (enableSelection ? 1 : 0);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-[#E6E6E6] bg-white overflow-hidden">
        <div className="divide-y divide-[#E6E6E6]">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-4 px-4 py-3.5">
              {(enableReorder || enableSelection) && (
                <div className="h-4 w-6 animate-pulse rounded bg-[#E6E6E6]" />
              )}
              {columns.map((_, j) => (
                <div key={j} className="h-4 flex-1 animate-pulse rounded bg-[#E6E6E6]" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  const hasBulkActionsActive = enableSelection && !!renderBulkActions;
  const isUnifiedToolbar = totalItems !== undefined;

  return (
    <div className="rounded-lg border border-[#E6E6E6] bg-white overflow-hidden flex flex-col">
      {(title || description || hasBulkActionsActive || totalItems !== undefined) && (
        <>
          {isUnifiedToolbar ? (
            <div className="border-b border-[#E6E6E6] bg-white px-4 flex items-center justify-between h-[56px] overflow-x-auto transition-all">
              <div className="flex items-center gap-3 w-full shrink-0">
                <span className="text-[13px] font-bold text-[#1A1A1A] whitespace-nowrap">{title || "List"}</span>

                {/* Showing Count */}
                {totalItems !== undefined && currentPage !== undefined && pageSize !== undefined && (
                  <span className="text-[12.5px] text-[#6B6B6B] whitespace-nowrap">
                    Showing {totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, totalItems)} of {totalItems}
                  </span>
                )}

                {/* Page Size Select */}
                {pageSize !== undefined && onPageSizeChange && (
                  <div className="flex items-center gap-1 shrink-0">
                    <select
                      value={pageSize}
                      onChange={(e) => onPageSizeChange(Number(e.target.value))}
                      className="h-8 rounded-md border border-[#E6E6E6] bg-white px-2 text-[12px] text-[#1A1A1A] outline-none shadow-xs cursor-pointer"
                    >
                      {(pageSizeOptions || [10, 25, 50, 100]).map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Prev / Next Buttons */}
                {currentPage !== undefined && totalPages !== undefined && onPageChange && (
                  <div className="flex items-center gap-1.5 ml-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                      className="h-8 rounded-md border border-[#E6E6E6] bg-white px-2.5 text-[12px] hover:bg-[#F5F5F5] disabled:opacity-40 shadow-xs cursor-pointer"
                    >
                      Prev
                    </button>
                    <span className="text-[12.5px] text-[#1A1A1A] font-semibold whitespace-nowrap">{currentPage}/{totalPages}</span>
                    <button
                      type="button"
                      onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                      className="h-8 rounded-md border border-[#E6E6E6] bg-white px-2.5 text-[12px] hover:bg-[#F5F5F5] disabled:opacity-40 shadow-xs cursor-pointer"
                    >
                      Next
                    </button>
                  </div>
                )}

                {/* Bulk Actions container */}
                {hasBulkActionsActive && (
                  <div className="flex items-center gap-2 border-l border-[#E6E6E6] pl-3 ml-1 shrink-0">
                    {renderBulkActions!(selectedIds)}
                  </div>
                )}

                {/* Extra header actions if any */}
                {headerActions && (
                  <div className="ml-auto flex items-center gap-2 shrink-0">
                    {headerActions}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="border-b border-[#E6E6E6] bg-white px-4 flex items-center justify-between h-[56px] transition-all">
              {hasBulkActionsActive ? (
                <div className="flex items-center justify-between gap-3 w-full animate-fade-in">
                  {renderBulkActions!(selectedIds)}
                </div>
              ) : (
                <div className="flex items-center justify-between w-full">
                  <div>
                    {title && <h3 className="text-[14.5px] font-bold text-[#1A1A1A]">{title}</h3>}
                    {description && <p className="mt-0.5 text-[12px] text-[#6B6B6B]">{description}</p>}
                  </div>
                  {headerActions}
                </div>
              )}
            </div>
          )}
        </>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#F8F8F8] border-b border-[#E6E6E6]">
            <tr>
              {enableReorder && (
                <th className="px-2 py-3 w-9 text-center" />
              )}
              {enableSelection && (
                <th className="px-2 py-3 w-9 text-center">
                  <input
                    type="checkbox"
                    checked={data.length > 0 && (selectedIds.length === data.length || (totalItems !== undefined && selectedIds.length >= totalItems))}
                    onChange={(e) => {
                      if (onSelectAll) {
                        void onSelectAll(e.target.checked);
                      } else if (onSelectionChange) {
                        if (e.target.checked) {
                          onSelectionChange(data.map((item) => String(item[rowKey])));
                        } else {
                          onSelectionChange([]);
                        }
                      }
                    }}
                    className="rounded border-gray-300 text-[#E31E24] focus:ring-[#E31E24] cursor-pointer"
                  />
                </th>
              )}
              {columns.map((col) => {
                const alignClass = col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left";
                return (
                  <th
                    key={String(col.key)}
                    className={cn("px-4 py-3 text-[11.5px] font-semibold uppercase tracking-wide text-[#9A9A9A]", alignClass)}
                    style={col.width ? { width: col.width } : undefined}
                  >
                    {col.label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E6E6E6]">
            {data.length === 0 ? (
              <tr>
                <td colSpan={totalColumns} className="px-4 py-12 text-center text-[#9A9A9A] text-[13.5px]">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row) => {
                const tooltip = typeof rowTooltip === "function" ? rowTooltip(row) : rowTooltip;
                const rowId = String(row[rowKey]);
                return (
                  <tr
                    key={rowId}
                    draggable={enableReorder && !disabledReorder}
                    onDragStart={() => {
                      if (enableReorder) setDraggingId(rowId);
                    }}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setOverId(null);
                    }}
                    onDragOver={(e) => {
                      if (enableReorder) {
                        e.preventDefault();
                        setOverId(rowId);
                      }
                    }}
                    onDrop={(e) => {
                      if (enableReorder) {
                        e.preventDefault();
                        const fromId = draggingId;
                        const toId = rowId;
                        if (fromId && toId && fromId !== toId) {
                          const fromIndex = data.findIndex((item) => String(item[rowKey]) === fromId);
                          const toIndex = data.findIndex((item) => String(item[rowKey]) === toId);
                          if (fromIndex >= 0 && toIndex >= 0) {
                            const next = [...data];
                            const [moved] = next.splice(fromIndex, 1);
                            next.splice(toIndex, 0, moved);
                            onReorder?.(next);
                          }
                        }
                        setDraggingId(null);
                        setOverId(null);
                      }
                    }}
                    onClick={() => onRowClick?.(row)}
                    title={tooltip}
                    className={cn(
                      "transition-colors",
                      onRowClick ? "cursor-pointer hover:bg-[#FFF8F8]" : "hover:bg-[#FAFAFA]",
                      draggingId === rowId && "opacity-50",
                      overId === rowId && draggingId && draggingId !== rowId && "bg-red-50 border-y-2 border-dashed border-[#E31E24]"
                    )}
                  >
                    {enableReorder && (
                      <td className="px-2 py-3 w-9 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 text-center">
                        <div className="flex justify-center items-center">
                          <GripVertical size={18} />
                        </div>
                      </td>
                    )}
                    {enableSelection && (
                      <td className="px-2 py-3 w-9 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-center items-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(rowId)}
                            onChange={(e) => {
                              if (!onSelectionChange) return;
                              const isShiftPressed = (e.nativeEvent as any).shiftKey;
                              const isSelected = selectedIds.includes(rowId);

                              if (isShiftPressed && lastSelectedId !== null) {
                                const ids = data.map((item) => String(item[rowKey]));
                                const prevIndex = ids.indexOf(lastSelectedId);
                                const currIndex = ids.indexOf(rowId);

                                if (prevIndex !== -1 && currIndex !== -1) {
                                  const start = Math.min(prevIndex, currIndex);
                                  const end = Math.max(prevIndex, currIndex);
                                  const rangeIds = ids.slice(start, end + 1);

                                  if (!isSelected) {
                                    onSelectionChange(Array.from(new Set([...selectedIds, ...rangeIds])));
                                  } else {
                                    onSelectionChange(selectedIds.filter((x) => !rangeIds.includes(x)));
                                  }
                                  setLastSelectedId(rowId);
                                  return;
                                }
                              }

                              if (isSelected) {
                                onSelectionChange(selectedIds.filter((x) => x !== rowId));
                              } else {
                                onSelectionChange([...selectedIds, rowId]);
                              }
                              setLastSelectedId(rowId);
                            }}
                            className="rounded border-gray-300 text-[#E31E24] focus:ring-[#E31E24] cursor-pointer"
                          />
                        </div>
                      </td>
                    )}
                    {columns.map((col) => {
                      const isStatusCol = col.key === "status" || col.enableStatusToggle === true;
                      const toggleHandler = col.onToggleStatus || (isStatusCol && onToggleStatus ? onToggleStatus : undefined);

                      let cellContent: ReactNode;

                      if (toggleHandler) {
                        const rawStatus = col.getStatus
                          ? col.getStatus(row)
                          : (row as Record<string, unknown>)[String(col.key)];
                        const isLoading = col.isStatusLoading
                          ? col.isStatusLoading(row)
                          : isStatusLoading
                            ? isStatusLoading(row)
                            : statusLoadingId === rowId;
                        const isDisabled = col.isStatusDisabled
                          ? col.isStatusDisabled(row)
                          : isStatusDisabled
                            ? isStatusDisabled(row)
                            : false;

                        cellContent = (
                          <TableStatusAction
                            status={rawStatus as string | boolean}
                            loading={isLoading}
                            disabled={isDisabled}
                            onToggle={() => toggleHandler(row)}
                          />
                        );
                      } else if (col.render) {
                        cellContent = col.render(row);
                      } else if (col.key === "status") {
                        const rawStatus = (row as Record<string, unknown>)[String(col.key)];
                        cellContent = <StatusBadge status={rawStatus as string | boolean} />;
                      } else {
                        cellContent = String((row as Record<string, unknown>)[String(col.key)] ?? "");
                      }

                      const alignClass = col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left";

                      return (
                        <td
                          key={String(col.key)}
                          className={cn("px-4 py-3 text-[13.5px] text-[#1A1A1A]", alignClass)}
                          style={col.width ? { width: col.width } : undefined}
                        >
                          {cellContent}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── TableStatusAction ────────────────────────────────────

export interface TableStatusActionProps {
  status: string | boolean;
  loading?: boolean;
  disabled?: boolean;
  onToggle: () => void | Promise<void>;
  activeLabel?: string;
  inactiveLabel?: string;
  tooltipActive?: string;
  tooltipInactive?: string;
  className?: string;
}

export function TableStatusAction({
  status,
  loading = false,
  disabled = false,
  onToggle,
  activeLabel,
  inactiveLabel,
  tooltipActive = "Click to deactivate",
  tooltipInactive = "Click to activate",
  className,
}: TableStatusActionProps) {
  const isCurrentlyActive =
    status === true ||
    String(status).toUpperCase() === "ACTIVE" ||
    String(status) === "true" ||
    String(status) === "1";

  const label = isCurrentlyActive ? activeLabel : inactiveLabel;
  const tooltip = isCurrentlyActive ? tooltipActive : tooltipInactive;

  return (
    <StatusBadge
      status={isCurrentlyActive ? "ACTIVE" : "INACTIVE"}
      label={label}
      loading={loading}
      disabled={disabled}
      onClick={onToggle}
      title={tooltip}
      className={className}
    />
  );
}

// ─── AdminSectionTable ────────────────────────────────────

export interface AdminSectionTableProps<T> {
  title: string;
  description?: string;
  addButtonLabel?: string;
  onAdd?: () => void;
  actionButtons?: ReactNode;
  columns: Column<T>[];
  data: T[];
  rowKey: keyof T;
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  rowTooltip?: string | ((row: T) => string);
  className?: string;
}

export function AdminSectionTable<T>({
  title,
  description,
  addButtonLabel,
  onAdd,
  actionButtons,
  columns,
  data,
  rowKey,
  isLoading,
  emptyMessage,
  onRowClick,
  rowTooltip,
  className,
}: AdminSectionTableProps<T>) {
  return (
    <div className={cn("rounded-xl border border-[#E6E6E6] bg-white p-5 space-y-4", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-[14px] font-semibold text-[#1A1A1A]">{title}</h3>
          {description && <p className="mt-0.5 text-[12.5px] text-[#9A9A9A]">{description}</p>}
        </div>
        <div className="flex items-center gap-2">
          {actionButtons}
          {addButtonLabel && onAdd && (
            <button
              type="button"
              onClick={onAdd}
              className="flex items-center gap-1.5 rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B]"
            >
              <Plus size={14} />
              {addButtonLabel}
            </button>
          )}
        </div>
      </div>
      <DataTable
        columns={columns}
        data={data}
        rowKey={rowKey}
        isLoading={isLoading}
        emptyMessage={emptyMessage}
        onRowClick={onRowClick}
        rowTooltip={rowTooltip}
      />
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────

export interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  alwaysShow?: boolean;
  className?: string;
}

export function Pagination({ page, totalPages, onPageChange, alwaysShow = false, className }: PaginationProps) {
  if (totalPages <= 1 && !alwaysShow) return null;
  const safeTotalPages = Math.max(1, totalPages || 1);
  return (
    <div className={cn("flex items-center justify-end gap-2", className)}>
      <button
        disabled={page <= 1}
        onClick={() => onPageChange(Math.max(1, page - 1))}
        className="flex items-center gap-1 rounded border border-[#E6E6E6] bg-white px-2.5 py-1.5 text-[13px] font-medium text-[#1A1A1A] disabled:text-[#9A9A9A] disabled:opacity-40 hover:bg-[#F2F2F2] transition-colors cursor-pointer disabled:cursor-not-allowed"
      >
        <ChevronLeft size={14} /> Prev
      </button>
      <span className="text-[13px] text-[#6B6B6B] px-1">
        Page {page} of {safeTotalPages}
      </span>
      <button
        disabled={page >= safeTotalPages}
        onClick={() => onPageChange(Math.min(safeTotalPages, page + 1))}
        className="flex items-center gap-1 rounded border border-[#E6E6E6] bg-white px-2.5 py-1.5 text-[13px] font-medium text-[#1A1A1A] disabled:text-[#9A9A9A] disabled:opacity-40 hover:bg-[#F2F2F2] transition-colors cursor-pointer disabled:cursor-not-allowed"
      >
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

export interface StatusBadgeProps {
  status: string | boolean;
  label?: string;
  loading?: boolean;
  disabled?: boolean;
  interactive?: boolean;
  onClick?: (e?: React.MouseEvent) => void | Promise<void>;
  title?: string;
  className?: string;
}

export function StatusBadge({
  status,
  label,
  loading = false,
  disabled = false,
  interactive,
  onClick,
  title,
  className,
}: StatusBadgeProps) {
  const isBool = typeof status === "boolean";
  const normalizedStatus = isBool
    ? (status ? "ACTIVE" : "INACTIVE")
    : String(status || "").toUpperCase();

  const displayLabel = label || (isBool ? (status ? "Active" : "Inactive") : String(status || "").replace(/_/g, " "));
  const style = STATUS_STYLES[normalizedStatus] || "bg-gray-50 text-gray-600 border-gray-200";

  const isClickable = !!onClick || interactive === true;
  const isCurrentlyActive = normalizedStatus === "ACTIVE" || status === true;
  const defaultTooltip = isClickable
    ? isCurrentlyActive
      ? "Click to deactivate"
      : "Click to activate"
    : undefined;
  const finalTitle = title ?? defaultTooltip;

  if (isClickable) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (!loading && !disabled) {
            void onClick?.(e);
          }
        }}
        disabled={disabled || loading}
        title={finalTitle}
        className={cn(
          "relative inline-flex min-w-[78px] shrink-0 items-center justify-center text-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium transition-all select-none focus:outline-none",
          style,
          disabled
            ? "opacity-50 cursor-not-allowed"
            : loading
              ? "opacity-75 cursor-wait"
              : "cursor-pointer hover:opacity-85 hover:shadow-xs",
          className
        )}
      >
        <span className={cn(loading && "invisible")}>{displayLabel}</span>
        {loading && (
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-white/70 backdrop-blur-[0.5px]">
            <span
              className="inline-block animate-spin rounded-full border border-gray-400 border-t-[#E31E24] w-3 h-3"
              aria-hidden="true"
            />
          </span>
        )}
      </button>
    );
  }

  return (
    <span
      title={finalTitle}
      className={cn(
        "inline-flex min-w-[78px] shrink-0 items-center justify-center text-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11.5px] font-medium",
        style,
        className
      )}
    >
      {displayLabel}
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
  confirmText?: string;
  loadingText?: string;
}

export function ConfirmModal({ 
  open, 
  title, 
  message, 
  onConfirm, 
  onCancel, 
  isLoading, 
  danger = true,
  confirmText = "Confirm",
  loadingText
}: ConfirmModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => {
      clearTimeout(timer);
      setMounted(false);
    };
  }, []);

  if (!open || !mounted) return null;

  const defaultLoadingText = danger ? "Deleting…" : "Confirming…";
  const finalLoadingText = loadingText || defaultLoadingText;

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
            {isLoading ? (
              <span className="flex items-center justify-center gap-1.5">
                <span className="inline-block animate-spin rounded-full border-2 border-white border-t-transparent w-3.5 h-3.5" aria-hidden="true" />
                <span>{finalLoadingText}</span>
              </span>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── AdminDeleteModal ───────────────────────────────────────

export interface AdminDeleteModalProps {
  open: boolean;
  onClose: () => void;
  itemName?: string;
  itemType?: string;
  onSoftDelete: () => Promise<void> | void;
  onPermanentDelete?: () => Promise<void> | void;
  isSoftDeleting?: boolean;
  isPermanentDeleting?: boolean;
  isLoading?: boolean;
  softDeleteDescription?: string;
  permanentDeleteDescription?: string;
  warningMessage?: string;
}

export function AdminDeleteModal({
  open,
  onClose,
  itemName,
  itemType = "item",
  onSoftDelete,
  onPermanentDelete,
  isSoftDeleting = false,
  isPermanentDeleting = false,
  isLoading = false,
  softDeleteDescription,
  permanentDeleteDescription,
  warningMessage,
}: AdminDeleteModalProps) {
  const [deleteType, setDeleteType] = useState<"soft" | "permanent">("soft");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => {
      clearTimeout(timer);
      setMounted(false);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setDeleteType("soft");
    }
  }, [open]);

  if (!open || !mounted) return null;

  const activeLoading = isSoftDeleting || isPermanentDeleting || isLoading;

  const handleConfirm = async () => {
    if (deleteType === "soft") {
      await onSoftDelete();
    } else if (onPermanentDelete) {
      await onPermanentDelete();
    }
  };

  const displayName = itemName ? `"${itemName}"` : itemType.toLowerCase();

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-[500px] rounded-2xl bg-white p-6 shadow-2xl animate-fade-in border border-[#E6E6E6]">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#F0F0F0]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-600">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h3 className="text-[16px] font-bold text-[#1A1A1A]">
                Delete {itemType}
              </h3>
              {itemName ? (
                <p className="text-[13px] font-medium text-[#6B6B6B] truncate max-w-[340px]">
                  Target: <span className="font-semibold text-[#1A1A1A]">{itemName}</span>
                </p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={activeLoading}
            className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-40"
          >
            <span className="sr-only">Close</span>
            ✕
          </button>
        </div>

        {/* Description / Warning */}
        <div className="py-3">
          <p className="text-[13px] leading-5 text-[#6B6B6B]">
            {warningMessage || `Choose the deletion method for this ${itemType.toLowerCase()}. Soft Delete is recommended for maintaining catalog and historical integrity.`}
          </p>
        </div>

        {/* Options */}
        <div className="space-y-3">
          {/* Option 1: Soft Delete (Default / Recommended) */}
          <div
            onClick={() => !activeLoading && setDeleteType("soft")}
            className={`cursor-pointer rounded-xl border p-3.5 transition-all ${
              deleteType === "soft"
                ? "border-[#1A1A1A] bg-neutral-50/80 ring-1 ring-[#1A1A1A]"
                : "border-[#E6E6E6] bg-white hover:border-neutral-300 hover:bg-neutral-50/40"
            } ${activeLoading ? "pointer-events-none opacity-60" : ""}`}
          >
            <div className="flex items-start gap-3">
              <div className="pt-0.5">
                <div
                  className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                    deleteType === "soft"
                      ? "border-[#1A1A1A] bg-[#1A1A1A]"
                      : "border-neutral-300 bg-white"
                  }`}
                >
                  {deleteType === "soft" && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13.5px] font-semibold text-[#1A1A1A]">
                    Soft Delete (Archive)
                  </span>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                    Recommended
                  </span>
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-[#6B6B6B]">
                  {softDeleteDescription || `Hides ${displayName} from the active storefront and admin catalog while safely retaining historical orders, quotes, and reports.`}
                </p>
              </div>
            </div>
          </div>

          {/* Option 2: Permanent Delete (Hard Delete) - Rendered if onPermanentDelete exists */}
          {onPermanentDelete ? (
            <div
              onClick={() => !activeLoading && setDeleteType("permanent")}
              className={`cursor-pointer rounded-xl border p-3.5 transition-all ${
                deleteType === "permanent"
                  ? "border-red-500 bg-red-50/50 ring-1 ring-red-500"
                  : "border-[#E6E6E6] bg-white hover:border-red-200 hover:bg-red-50/20"
              } ${activeLoading ? "pointer-events-none opacity-60" : ""}`}
            >
              <div className="flex items-start gap-3">
                <div className="pt-0.5">
                  <div
                    className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                      deleteType === "permanent"
                        ? "border-red-600 bg-red-600"
                        : "border-neutral-300 bg-white"
                    }`}
                  >
                    {deleteType === "permanent" && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13.5px] font-semibold text-red-700">
                      Permanent Delete (Hard Delete)
                    </span>
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-800 border border-red-200">
                      Irreversible
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-[#6B6B6B]">
                    {permanentDeleteDescription || `Physically removes ${displayName} from the database. Blocked by system guards if orders or dependencies reference it.`}
                  </p>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-4 mt-4 border-t border-[#F0F0F0]">
          <button
            type="button"
            onClick={onClose}
            disabled={activeLoading}
            className="rounded-lg border border-[#E6E6E6] bg-white px-4 py-2 text-[13px] font-medium text-[#1A1A1A] hover:bg-[#F2F2F2] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={activeLoading}
            className={cn(
              "rounded-lg px-4 py-2 text-[13px] font-semibold text-white transition-colors shadow-2xs disabled:opacity-50 flex items-center justify-center gap-2",
              deleteType === "soft"
                ? "bg-[#1A1A1A] hover:bg-neutral-800"
                : "bg-[#E31E24] hover:bg-[#B5151B]"
            )}
          >
            {activeLoading ? (
              <>
                <span className="inline-block animate-spin rounded-full border-2 border-white border-t-transparent w-3.5 h-3.5" aria-hidden="true" />
                <span>{deleteType === "soft" ? "Archiving..." : "Deleting permanently..."}</span>
              </>
            ) : (
              deleteType === "soft" ? `Soft Delete ${itemType}` : `Permanently Delete ${itemType}`
            )}
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

export function AdminInput({ label, error, className, onChange, type, ...props }: AdminInputProps) {
  const isNumeric = type === "number";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isNumeric) {
      let val = e.target.value;
      val = val.replace(/[^0-9.]/g, "");
      const dotIndex = val.indexOf(".");
      if (dotIndex !== -1) {
        val = val.substring(0, dotIndex + 1) + val.substring(dotIndex + 1).replace(/\./g, "");
      }
      e.target.value = val;
    }
    if (onChange) {
      onChange(e);
    }
  };

  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-[13px] font-medium text-[#1A1A1A]">
          {label}
          {props.required && <span className="text-[#E31E24] ml-1">*</span>}
        </label>
      )}
      <input
        {...props}
        type={isNumeric ? "text" : type}
        onChange={handleChange}
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
      {label && (
        <label className="block text-[13px] font-medium text-[#1A1A1A]">
          {label}
          {props.required && <span className="text-[#E31E24] ml-1">*</span>}
        </label>
      )}
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
  selectAllLabel?: string;
  className?: string;
  required?: boolean;
  id?: string;
  onBlur?: () => void;
}

export function AdminMultiSelect({
  label,
  error,
  options,
  selectedValues,
  value,
  onChange,
  placeholder = "Select options...",
  className,
  selectAllLabel = "Select All",
  required,
  id,
  onBlur
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

  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

  const toggleOption = (val: string, isShift: boolean) => {
    let next: string[];
    if (isShift && lastSelectedId) {
      const lastIndex = options.findIndex((o) => o.value === lastSelectedId);
      const currentIndex = options.findIndex((o) => o.value === val);
      if (lastIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(lastIndex, currentIndex);
        const end = Math.max(lastIndex, currentIndex);
        const rangeValues = options.slice(start, end + 1).map((o) => o.value);
        
        const lastIsChecked = currentValues.includes(lastSelectedId);
        if (lastIsChecked) {
          next = Array.from(new Set([...currentValues, ...rangeValues]));
        } else {
          next = currentValues.filter((v) => !rangeValues.includes(v));
        }
      } else {
        next = currentValues.includes(val)
          ? currentValues.filter((v) => v !== val)
          : [...currentValues, val];
      }
    } else {
      next = currentValues.includes(val)
        ? currentValues.filter((v) => v !== val)
        : [...currentValues, val];
    }
    onChange(next);
    setLastSelectedId(val);
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
      {label && (
        <label className="block text-[13px] font-medium text-[#1A1A1A]">
          {label}
          {required && <span className="text-[#E31E24] ml-1">*</span>}
        </label>
      )}
      <button
        id={id}
        onBlur={onBlur}
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
                    {selectAllLabel}
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
                      onClick={(e) => toggleOption(option.value, e.shiftKey)}
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

import { stripHtmlTags } from "@/utils/sanitize";

interface AdminRichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  error?: string;
  label?: string;
  mediaContext?: { entityType: string; entityId?: string };
  maxLength?: number;
  showCharCount?: boolean;
  hideImageUpload?: boolean;
  compact?: boolean;
}

export function AdminRichTextEditor({
  value,
  onChange,
  placeholder,
  className,
  error,
  label,
  mediaContext,
  maxLength,
  showCharCount,
  hideImageUpload,
  compact,
}: AdminRichTextEditorProps) {
  const { showToast } = useSharedToast();
  const editorRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [editorMode, setEditorMode] = useState<"visual" | "code">("visual");

  // Link Modal State
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [linkNewTab, setLinkNewTab] = useState(true);

  // Image Modal State
  const [imgModalOpen, setImgModalOpen] = useState(false);
  const [imgTab, setImgTab] = useState<"upload" | "url">("upload");
  const [selectedImgFile, setSelectedImgFile] = useState<File | null>(null);
  const [selectedImgPreview, setSelectedImgPreview] = useState<string>("");
  const [imgUrlInput, setImgUrlInput] = useState("");
  const [imgAltInput, setImgAltInput] = useState("");

  const plainText = stripHtmlTags(value);
  const charCount = plainText.length;
  const isOverLimit = Boolean(maxLength && charCount > maxLength);
  const isAtLimit = Boolean(maxLength && charCount >= maxLength && !isOverLimit);
  const [hitLimitShake, setHitLimitShake] = useState(false);

  useEffect(() => {
    if (editorMode === "visual" && editorRef.current && editorRef.current.innerHTML !== value) {
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
          btn.className =
            "img-delete-btn absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#E31E24] text-white text-[11px] font-bold shadow-md hover:bg-[#B5151B] transition-transform hover:scale-110 cursor-pointer";
          btn.title = "Remove image";
          btn.innerHTML = "✕";

          img.parentNode?.insertBefore(wrapper, img);
          wrapper.appendChild(img);
          wrapper.appendChild(btn);
        }
      });
    }
  }, [value, editorMode]);

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
    if (editorMode !== "visual") return;
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!maxLength) return;
    if (
      e.ctrlKey ||
      e.metaKey ||
      e.altKey ||
      e.key === "Backspace" ||
      e.key === "Delete" ||
      e.key === "ArrowLeft" ||
      e.key === "ArrowRight" ||
      e.key === "ArrowUp" ||
      e.key === "ArrowDown" ||
      e.key === "Tab" ||
      e.key === "Escape" ||
      e.key === "Home" ||
      e.key === "End"
    ) {
      return;
    }
    const selection = typeof window !== "undefined" ? window.getSelection() : null;
    const hasSelection = selection && !selection.isCollapsed && selection.toString().length > 0;
    if (!hasSelection && charCount >= maxLength && (e.key.length === 1 || e.key === "Enter")) {
      e.preventDefault();
      setHitLimitShake(true);
      setTimeout(() => setHitLimitShake(false), 1000);
    }
  };

  const openLinkDialog = () => {
    saveCursorLocation();
    const sel = typeof window !== "undefined" ? window.getSelection() : null;
    const selectedText = sel?.toString() || "";
    setLinkText(selectedText);
    setLinkUrl("https://");
    setLinkNewTab(true);
    setLinkModalOpen(true);
  };

  const handleApplyLink = () => {
    if (!linkUrl || linkUrl.trim() === "https://" || linkUrl.trim() === "") {
      showToast("Please enter a valid link URL.", "error");
      return;
    }
    const targetAttr = linkNewTab ? ' target="_blank" rel="noopener noreferrer"' : "";
    const textToUse = linkText.trim() || linkUrl.trim();
    const linkHtml = `<a href="${linkUrl.trim()}"${targetAttr} class="text-[#E31E24] underline underline-offset-2 font-medium">${textToUse}</a>`;
    insertHtmlAtSavedCursor(linkHtml);
    setLinkModalOpen(false);
  };

  const openImageDialog = () => {
    saveCursorLocation();
    setSelectedImgFile(null);
    setSelectedImgPreview("");
    setImgUrlInput("");
    setImgAltInput("");
    setImgTab("upload");
    setImgModalOpen(true);
  };

  const handleSelectFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      showToast("Please select a valid image file (PNG, JPG, WEBP, GIF).", "error");
      return;
    }
    setSelectedImgFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setSelectedImgPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUploadAndInsertImage = async () => {
    if (!selectedImgFile) {
      showToast("Please select an image file first.", "error");
      return;
    }
    setUploadingImg(true);
    try {
      const formData = new FormData();
      formData.append("entityType", mediaContext?.entityType || "SYSTEM");
      if (mediaContext?.entityId) formData.append("entityId", mediaContext.entityId);
      formData.append("purpose", "RICH_TEXT_IMAGE");
      formData.append("files", selectedImgFile);
      const res = await adminApi.post("/media", formData);
      const mediaItem = Array.isArray(res.data?.data) ? res.data.data[0] : res.data?.data || res.data;
      const url = mediaItem?.url || mediaItem?.location || (typeof mediaItem === "string" ? mediaItem : "");
      if (url) {
        const cleanImgHtml = `<span class="img-wrapper relative inline-block my-2 mr-3 align-bottom group select-none" contenteditable="false"><img src="${url}" alt="${imgAltInput.trim() || selectedImgFile.name || "Product Image"}" class="max-h-56 max-w-full w-auto inline-block rounded-lg border border-[#E5E7EB] bg-white p-1.5 shadow-2xs" /><button type="button" class="img-delete-btn absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#E31E24] text-white text-[11px] font-bold shadow-md hover:bg-[#B5151B] transition-transform hover:scale-110 cursor-pointer" title="Remove image">✕</button></span><p><br></p>`;
        insertHtmlAtSavedCursor(cleanImgHtml);
        setImgModalOpen(false);
        showToast("Image inserted successfully.", "success");
      } else {
        showToast("Failed to get uploaded media URL.", "error");
      }
    } catch (err) {
      console.error("Image upload failed", err);
      showToast("Image upload failed. Please try again.", "error");
    } finally {
      setUploadingImg(false);
    }
  };

  const handleInsertImageUrl = () => {
    if (!imgUrlInput.trim()) {
      showToast("Please enter an image URL.", "error");
      return;
    }
    const cleanImgHtml = `<span class="img-wrapper relative inline-block my-2 mr-3 align-bottom group select-none" contenteditable="false"><img src="${imgUrlInput.trim()}" alt="${imgAltInput.trim() || "Product Image"}" class="max-h-56 max-w-full w-auto inline-block rounded-lg border border-[#E5E7EB] bg-white p-1.5 shadow-2xs" /><button type="button" class="img-delete-btn absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#E31E24] text-white text-[11px] font-bold shadow-md hover:bg-[#B5151B] transition-transform hover:scale-110 cursor-pointer" title="Remove image">✕</button></span><p><br></p>`;
    insertHtmlAtSavedCursor(cleanImgHtml);
    setImgModalOpen(false);
    showToast("Image inserted successfully.", "success");
  };

  const isMinimal = Boolean(hideImageUpload || compact);

  return (
    <div className="space-y-1.5">
      {label && (
        <div className="flex items-center justify-between">
          <label className="block text-[13px] font-semibold text-[#1A1A1A]">{label}</label>
          <div className="flex items-center gap-1 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] p-0.5 text-[11.5px] font-medium shadow-2xs">
            <button
              type="button"
              onClick={() => setEditorMode("visual")}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1 transition-all ${
                editorMode === "visual"
                  ? "bg-white text-[#E31E24] shadow-2xs font-bold"
                  : "text-[#64748B] hover:text-[#0F172A]"
              }`}
            >
              <Eye size={13} />
              Visual
            </button>
            <button
              type="button"
              onClick={() => setEditorMode("code")}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1 transition-all ${
                editorMode === "code"
                  ? "bg-white text-[#E31E24] shadow-2xs font-bold"
                  : "text-[#64748B] hover:text-[#0F172A]"
              }`}
            >
              <Code2 size={13} />
              HTML Code
            </button>
          </div>
        </div>
      )}
      <div
        className={cn(
          "rounded-lg border bg-white shadow-2xs transition-all overflow-hidden",
          error || isOverLimit
            ? "border-red-400 ring-1 ring-red-400"
            : isAtLimit
              ? "border-amber-400 ring-1 ring-amber-400"
              : "border-[#CBD5E1] focus-within:border-[#E31E24] focus-within:ring-2 focus-within:ring-[#E31E24]/10",
          className
        )}
      >
        {/* Toolbar Header */}
        {editorMode === "visual" && (
          <div className="flex flex-wrap items-center gap-1 border-b border-[#E2E8F0] bg-[#F8FAFC] px-2 py-1.5 select-none">
            {/* Group 1: Typography Formatting */}
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                title="Bold (Ctrl+B)"
                className="flex h-7 w-7 items-center justify-center rounded text-[#475569] hover:bg-[#E2E8F0] hover:text-[#0F172A] transition-colors"
                onClick={() => applyFormat("bold")}
              >
                <Bold size={14} />
              </button>
              <button
                type="button"
                title="Italic (Ctrl+I)"
                className="flex h-7 w-7 items-center justify-center rounded text-[#475569] hover:bg-[#E2E8F0] hover:text-[#0F172A] transition-colors"
                onClick={() => applyFormat("italic")}
              >
                <Italic size={14} />
              </button>
              <button
                type="button"
                title="Underline (Ctrl+U)"
                className="flex h-7 w-7 items-center justify-center rounded text-[#475569] hover:bg-[#E2E8F0] hover:text-[#0F172A] transition-colors"
                onClick={() => applyFormat("underline")}
              >
                <Underline size={14} />
              </button>
              <button
                type="button"
                title="Strikethrough"
                className="flex h-7 w-7 items-center justify-center rounded text-[#475569] hover:bg-[#E2E8F0] hover:text-[#0F172A] transition-colors"
                onClick={() => applyFormat("strikeThrough")}
              >
                <Strikethrough size={14} />
              </button>
            </div>

            <div className="h-4 w-px bg-[#CBD5E1] mx-1" />

            {/* Group 2: Headings & Block Types */}
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                title="Paragraph"
                className="flex h-7 px-2 items-center justify-center rounded text-[11.5px] font-bold text-[#475569] hover:bg-[#E2E8F0] hover:text-[#0F172A] transition-colors"
                onClick={() => applyFormat("formatBlock", "p")}
              >
                P
              </button>
              <button
                type="button"
                title="Heading 2"
                className="flex h-7 w-7 items-center justify-center rounded text-[#475569] hover:bg-[#E2E8F0] hover:text-[#0F172A] transition-colors"
                onClick={() => applyFormat("formatBlock", "h2")}
              >
                <Heading2 size={15} />
              </button>
              <button
                type="button"
                title="Heading 3"
                className="flex h-7 w-7 items-center justify-center rounded text-[#475569] hover:bg-[#E2E8F0] hover:text-[#0F172A] transition-colors"
                onClick={() => applyFormat("formatBlock", "h3")}
              >
                <Heading3 size={15} />
              </button>
              <button
                type="button"
                title="Quote Block"
                className="flex h-7 w-7 items-center justify-center rounded text-[#475569] hover:bg-[#E2E8F0] hover:text-[#0F172A] transition-colors"
                onClick={() => applyFormat("formatBlock", "blockquote")}
              >
                <Quote size={14} />
              </button>
              <button
                type="button"
                title="Code Snippet"
                className="flex h-7 w-7 items-center justify-center rounded text-[#475569] hover:bg-[#E2E8F0] hover:text-[#0F172A] transition-colors"
                onClick={() => applyFormat("formatBlock", "pre")}
              >
                <Code size={14} />
              </button>
            </div>

            <div className="h-4 w-px bg-[#CBD5E1] mx-1" />

            {/* Group 3: Lists */}
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                title="Bullet List"
                className="flex h-7 w-7 items-center justify-center rounded text-[#475569] hover:bg-[#E2E8F0] hover:text-[#0F172A] transition-colors"
                onClick={() => applyFormat("insertUnorderedList")}
              >
                <List size={14} />
              </button>
              <button
                type="button"
                title="Numbered List"
                className="flex h-7 w-7 items-center justify-center rounded text-[#475569] hover:bg-[#E2E8F0] hover:text-[#0F172A] transition-colors"
                onClick={() => applyFormat("insertOrderedList")}
              >
                <ListOrdered size={14} />
              </button>
            </div>

            <div className="h-4 w-px bg-[#CBD5E1] mx-1" />

            {/* Group 4: Alignment */}
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                title="Align Left"
                className="flex h-7 w-7 items-center justify-center rounded text-[#475569] hover:bg-[#E2E8F0] hover:text-[#0F172A] transition-colors"
                onClick={() => applyFormat("justifyLeft")}
              >
                <AlignLeft size={14} />
              </button>
              <button
                type="button"
                title="Align Center"
                className="flex h-7 w-7 items-center justify-center rounded text-[#475569] hover:bg-[#E2E8F0] hover:text-[#0F172A] transition-colors"
                onClick={() => applyFormat("justifyCenter")}
              >
                <AlignCenter size={14} />
              </button>
              <button
                type="button"
                title="Align Right"
                className="flex h-7 w-7 items-center justify-center rounded text-[#475569] hover:bg-[#E2E8F0] hover:text-[#0F172A] transition-colors"
                onClick={() => applyFormat("justifyRight")}
              >
                <AlignRight size={14} />
              </button>
              <button
                type="button"
                title="Justify"
                className="flex h-7 w-7 items-center justify-center rounded text-[#475569] hover:bg-[#E2E8F0] hover:text-[#0F172A] transition-colors"
                onClick={() => applyFormat("justifyFull")}
              >
                <AlignJustify size={14} />
              </button>
            </div>

            <div className="h-4 w-px bg-[#CBD5E1] mx-1" />

            {/* Group 5: Link & Media */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                title="Insert Link"
                className="flex items-center gap-1.5 rounded bg-blue-50/70 border border-blue-200/60 px-2.5 py-1 text-[12px] font-semibold text-blue-700 hover:bg-blue-100 transition-colors"
                onClick={openLinkDialog}
              >
                <Link2 size={13} />
                Link
              </button>

              {!isMinimal && (
                <button
                  type="button"
                  title="Insert Image"
                  className="flex items-center gap-1.5 rounded bg-red-50 border border-red-200/70 px-2.5 py-1 text-[12px] font-semibold text-[#E31E24] hover:bg-red-100 transition-colors"
                  onClick={openImageDialog}
                >
                  <ImageIcon size={13} />
                  Image
                </button>
              )}
            </div>

            <div className="h-4 w-px bg-[#CBD5E1] mx-1" />

            {/* Group 6: History & Clear */}
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                title="Undo (Ctrl+Z)"
                className="flex h-7 w-7 items-center justify-center rounded text-[#475569] hover:bg-[#E2E8F0] hover:text-[#0F172A] transition-colors"
                onClick={() => applyFormat("undo")}
              >
                <Undo2 size={14} />
              </button>
              <button
                type="button"
                title="Redo (Ctrl+Y)"
                className="flex h-7 w-7 items-center justify-center rounded text-[#475569] hover:bg-[#E2E8F0] hover:text-[#0F172A] transition-colors"
                onClick={() => applyFormat("redo")}
              >
                <Redo2 size={14} />
              </button>
              <button
                type="button"
                title="Clear Formatting"
                className="flex h-7 w-7 items-center justify-center rounded text-[#64748B] hover:bg-[#E2E8F0] hover:text-[#E31E24] transition-colors"
                onClick={() => applyFormat("removeFormat")}
              >
                <RemoveFormatting size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Editor Body Area */}
        {editorMode === "visual" ? (
          <div className="relative">
            {!value && !isFocused ? (
              <div className="pointer-events-none absolute inset-0 px-4 py-3 text-[13.5px] text-[#94A3B8]">
                {placeholder || "Enter description..."}
              </div>
            ) : null}
            <div
              ref={editorRef}
              contentEditable
              role="textbox"
              aria-multiline="true"
              suppressContentEditableWarning
              onClick={handleEditorClick}
              onKeyDown={handleKeyDown}
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
              className="min-h-[160px] w-full bg-white px-4 py-3 text-[13.5px] leading-relaxed text-[#1E293B] outline-none [&_h2]:text-[18px] [&_h2]:font-bold [&_h2]:text-[#0F172A] [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h3]:text-[15px] [&_h3]:font-bold [&_h3]:text-[#0F172A] [&_h3]:mt-2.5 [&_h3]:mb-1 [&_p]:text-[13.5px] [&_p]:leading-relaxed [&_p]:text-[#334155] [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ul]:space-y-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 [&_ol]:space-y-1 [&_blockquote]:border-l-4 [&_blockquote]:border-[#E31E24] [&_blockquote]:bg-[#F8FAFC] [&_blockquote]:pl-3.5 [&_blockquote]:py-1.5 [&_blockquote]:my-2 [&_blockquote]:italic [&_blockquote]:text-[#475569] [&_blockquote]:rounded-r [&_pre]:bg-[#0F172A] [&_pre]:text-[#F8FAFC] [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:font-mono [&_pre]:text-[12px] [&_pre]:my-2 [&_pre]:overflow-x-auto [&_code]:bg-[#F1F5F9] [&_code]:text-[#E31E24] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:text-[12px] [&_a]:text-[#E31E24] [&_a]:underline [&_a]:underline-offset-2"
            />
          </div>
        ) : (
          <div className="p-3 bg-[#0F172A]">
            <textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Enter HTML markup here..."
              rows={10}
              className="w-full bg-transparent font-mono text-[13px] text-[#38BDF8] outline-none resize-y p-1 leading-relaxed selection:bg-[#38BDF8]/30"
            />
          </div>
        )}
      </div>

      {/* Character Count & Alerts */}
      {(showCharCount || maxLength) && (
        <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11.5px] pt-1">
          <div className="flex items-center gap-1.5">
            {isOverLimit ? (
              <span className="inline-flex items-center gap-1 rounded bg-red-50 px-2 py-0.5 font-semibold text-red-700 border border-red-200">
                ⚠️ Limit exceeded by {charCount - (maxLength ?? 0)} characters. Please shorten text before saving.
              </span>
            ) : isAtLimit ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 font-semibold text-amber-800 border border-amber-200 transition-all",
                  hitLimitShake && "ring-2 ring-amber-400 font-bold scale-[1.02]"
                )}
              >
                ⚠️ Maximum limit reached ({maxLength}/{maxLength} chars). Further typing is blocked.
              </span>
            ) : (
              <span className="text-[#888]">
                {maxLength ? `${maxLength - charCount} characters remaining` : "Introductory text (plain text counted)"}
              </span>
            )}
          </div>
          <span className={cn("font-medium", isOverLimit ? "text-red-600 font-bold" : isAtLimit ? "text-amber-700 font-semibold" : "text-[#888]")}>
            {charCount} {maxLength ? `/ ${maxLength}` : ""} chars
          </span>
        </div>
      )}

      {/* Link Inserter Modal */}
      {linkModalOpen && typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
                <h4 className="text-[15px] font-bold text-[#1A1A1A] flex items-center gap-2">
                  <Link2 size={16} className="text-[#E31E24]" />
                  Insert Hyperlink
                </h4>
                <button
                  type="button"
                  onClick={() => setLinkModalOpen(false)}
                  className="text-[#9CA3AF] hover:text-[#1A1A1A] transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[12.5px] font-semibold text-[#374151] mb-1">Link URL</label>
                  <input
                    type="url"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="w-full rounded-md border border-[#D1D5DB] px-3 py-2 text-[13px] outline-none focus:border-[#E31E24] focus:ring-1 focus:ring-[#E31E24]"
                  />
                </div>

                <div>
                  <label className="block text-[12.5px] font-semibold text-[#374151] mb-1">Display Text</label>
                  <input
                    type="text"
                    value={linkText}
                    onChange={(e) => setLinkText(e.target.value)}
                    placeholder="Click here to view"
                    className="w-full rounded-md border border-[#D1D5DB] px-3 py-2 text-[13px] outline-none focus:border-[#E31E24] focus:ring-1 focus:ring-[#E31E24]"
                  />
                </div>

                <label className="flex items-center gap-2 text-[13px] text-[#374151] cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    checked={linkNewTab}
                    onChange={(e) => setLinkNewTab(e.target.checked)}
                    className="rounded border-[#D1D5DB] text-[#E31E24] focus:ring-[#E31E24]"
                  />
                  Open link in a new tab
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[#E5E7EB] pt-3">
                <button
                  type="button"
                  onClick={() => setLinkModalOpen(false)}
                  className="rounded-md border border-[#D1D5DB] bg-white px-3.5 py-1.5 text-[13px] font-medium text-[#374151] hover:bg-[#F3F4F6] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleApplyLink}
                  className="rounded-md bg-[#E31E24] px-4 py-1.5 text-[13px] font-semibold text-white hover:bg-[#B5151B] transition-colors cursor-pointer"
                >
                  Insert Link
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Image Inserter Modal */}
      {imgModalOpen && typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
                <h4 className="text-[15px] font-bold text-[#1A1A1A] flex items-center gap-2">
                  <ImageIcon size={16} className="text-[#E31E24]" />
                  Insert Image
                </h4>
                <button
                  type="button"
                  onClick={() => setImgModalOpen(false)}
                  className="text-[#9CA3AF] hover:text-[#1A1A1A] transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Tab selection */}
              <div className="flex border-b border-[#E5E7EB]">
                <button
                  type="button"
                  onClick={() => setImgTab("upload")}
                  className={`flex flex-1 items-center justify-center gap-1.5 pb-2.5 text-[13px] font-semibold border-b-2 transition-all cursor-pointer ${
                    imgTab === "upload"
                      ? "border-[#E31E24] text-[#E31E24]"
                      : "border-transparent text-[#6B7280] hover:text-[#1A1A1A]"
                  }`}
                >
                  <Upload size={14} />
                  Upload File
                </button>
                <button
                  type="button"
                  onClick={() => setImgTab("url")}
                  className={`flex flex-1 items-center justify-center gap-1.5 pb-2.5 text-[13px] font-semibold border-b-2 transition-all cursor-pointer ${
                    imgTab === "url"
                      ? "border-[#E31E24] text-[#E31E24]"
                      : "border-transparent text-[#6B7280] hover:text-[#1A1A1A]"
                  }`}
                >
                  <Globe size={14} />
                  Image URL
                </button>
              </div>

              {imgTab === "upload" ? (
                <div className="space-y-3">
                  {selectedImgPreview ? (
                    <div className="relative flex flex-col items-center rounded-lg border border-[#E5E7EB] bg-[#F8FAFC] p-3 text-center">
                      <img
                        src={selectedImgPreview}
                        alt="Selected preview"
                        className="max-h-36 w-auto rounded-md object-contain shadow-2xs mb-2 border border-[#E2E8F0] bg-white p-1"
                      />
                      <div className="text-[12px] font-medium text-[#1E293B] truncate max-w-full">
                        {selectedImgFile?.name}
                      </div>
                      <div className="text-[11px] text-[#64748B]">
                        {selectedImgFile ? `${(selectedImgFile.size / 1024).toFixed(1)} KB` : ""}
                      </div>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="mt-2 text-[12px] font-semibold text-[#E31E24] hover:underline cursor-pointer"
                      >
                        Change file
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-6 text-center hover:bg-[#F1F5F9] hover:border-[#94A3B8] cursor-pointer transition-colors"
                    >
                      <Upload size={26} className="text-[#94A3B8] mb-2" />
                      <p className="text-[13px] font-semibold text-[#334155]">
                        Click or drag & drop image to select
                      </p>
                      <p className="text-[11.5px] text-[#94A3B8] mt-0.5">PNG, JPG, WEBP, GIF up to 10MB</p>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleSelectFile(file);
                      e.target.value = "";
                    }}
                  />

                  <div>
                    <label className="block text-[12px] font-medium text-[#64748B] mb-1">Alt description (optional)</label>
                    <input
                      type="text"
                      value={imgAltInput}
                      onChange={(e) => setImgAltInput(e.target.value)}
                      placeholder="e.g. Product diagram or technical illustration"
                      className="w-full rounded-md border border-[#D1D5DB] px-3 py-1.5 text-[12.5px] outline-none focus:border-[#E31E24]"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[12.5px] font-semibold text-[#374151] mb-1">Image URL</label>
                    <input
                      type="url"
                      value={imgUrlInput}
                      onChange={(e) => setImgUrlInput(e.target.value)}
                      placeholder="https://example.com/image.jpg"
                      className="w-full rounded-md border border-[#D1D5DB] px-3 py-2 text-[13px] outline-none focus:border-[#E31E24] focus:ring-1 focus:ring-[#E31E24]"
                    />
                  </div>

                  {imgUrlInput.trim() && (
                    <div className="flex items-center justify-center p-2 rounded-md border border-[#E2E8F0] bg-[#F8FAFC]">
                      <img
                        src={imgUrlInput.trim()}
                        alt="URL preview"
                        onError={(e) => ((e.target as HTMLElement).style.display = "none")}
                        className="max-h-28 rounded object-contain"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-[12px] font-medium text-[#64748B] mb-1">Alt description (optional)</label>
                    <input
                      type="text"
                      value={imgAltInput}
                      onChange={(e) => setImgAltInput(e.target.value)}
                      placeholder="e.g. Product diagram or technical illustration"
                      className="w-full rounded-md border border-[#D1D5DB] px-3 py-1.5 text-[12.5px] outline-none focus:border-[#E31E24]"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 border-t border-[#E5E7EB] pt-3">
                <button
                  type="button"
                  onClick={() => setImgModalOpen(false)}
                  className="rounded-md border border-[#D1D5DB] bg-white px-3.5 py-1.5 text-[13px] font-medium text-[#374151] hover:bg-[#F3F4F6] cursor-pointer"
                >
                  Cancel
                </button>
                {imgTab === "upload" ? (
                  <button
                    type="button"
                    disabled={!selectedImgFile || uploadingImg}
                    onClick={handleUploadAndInsertImage}
                    className="flex items-center gap-1.5 rounded-md bg-[#E31E24] px-4 py-1.5 text-[13px] font-semibold text-white hover:bg-[#B5151B] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {uploadingImg ? (
                      <>
                        <Loader2 size={13} className="animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      "Upload & Insert Image"
                    )}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={!imgUrlInput.trim()}
                    onClick={handleInsertImageUrl}
                    className="rounded-md bg-[#E31E24] px-4 py-1.5 text-[13px] font-semibold text-white hover:bg-[#B5151B] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Insert Image
                  </button>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

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

export { AdminListToolbar } from "@/components/admin/layout/AdminListToolbar";
export { AdminStatsGrid } from "@/components/admin/layout/AdminStatsGrid";
export { AdminStickySaveBar } from "@/components/admin/AdminStickySaveBar";
export { default as LoadingButton } from "@/components/ui/LoadingSpinner/LoadingButton";
export { default as Spinner } from "@/components/ui/LoadingSpinner/Spinner";
export { AdminBulkActionsBar } from "./AdminBulkActionsBar";
export { RefreshButton } from "@/components/admin/RefreshButton";



