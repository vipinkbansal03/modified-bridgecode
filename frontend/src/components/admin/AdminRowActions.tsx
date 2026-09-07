"use client";

import React, { type ReactNode, type MouseEvent } from "react";
import Link from "next/link";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/utils/cn";
import { Tooltip } from "@/components/ui/Tooltip";

export interface AdminRowActionConfig {
  /** Optional navigation destination. If provided, renders a Next.js <Link> */
  href?: string;
  /** Optional link target (e.g. '_blank') */
  target?: string;
  /** Optional click handler. If provided without href, renders a <button> */
  onClick?: (e: MouseEvent<HTMLElement>) => void;
  /** Accessible title and tooltip */
  title?: string;
  /** Accessible aria-label (falls back to title) */
  ariaLabel?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Loading spinner state */
  loading?: boolean;
  /** Custom icon override */
  icon?: ReactNode;
  /** Custom class override */
  className?: string;
  /** Conditional visibility guard. If false, action is omitted */
  show?: boolean;
}

export interface AdminActionButtonProps {
  action?: AdminRowActionConfig | null | false;
  defaultIcon: ReactNode;
  defaultTitle: string;
  variant?: "default" | "danger";
  className?: string;
}

export function AdminActionButton({
  action,
  defaultIcon,
  defaultTitle,
  variant = "default",
  className,
}: AdminActionButtonProps) {
  if (!action || action.show === false) return null;

  const {
    href,
    target,
    onClick,
    title = defaultTitle,
    ariaLabel,
    disabled = false,
    loading = false,
    icon = defaultIcon,
    className: actionClassName,
  } = action;

  const baseClasses = cn(
    "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors shadow-2xs",
    variant === "danger"
      ? "border-[#E6E6E6] bg-white text-[#E31E24] hover:bg-[#FFF5F5] hover:border-[#F2C9C9] active:bg-[#FEEAEA]"
      : "border-[#E6E6E6] bg-white text-[#6B6B6B] hover:bg-[#F5F5F5] hover:text-[#1A1A1A] active:bg-[#ECECEC]",
    disabled ? "cursor-not-allowed opacity-40 hover:bg-white hover:text-inherit hover:border-[#E6E6E6]" : "cursor-pointer",
    className,
    actionClassName,
  );

  const content = loading ? (
    <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
  ) : (
    icon
  );

  const element =
    href && !disabled ? (
      <Link
        href={href}
        target={target}
        aria-label={ariaLabel || title}
        className={baseClasses}
        onClick={onClick}
      >
        {content}
      </Link>
    ) : disabled ? (
      <span className="inline-flex cursor-not-allowed">
        <button
          type="button"
          disabled
          aria-label={ariaLabel || title}
          className={cn(baseClasses, "pointer-events-none")}
          tabIndex={-1}
        >
          {content}
        </button>
      </span>
    ) : (
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        aria-label={ariaLabel || title}
        className={baseClasses}
      >
        {content}
      </button>
    );

  if (title) {
    return (
      <Tooltip content={title} side="top" disabled={loading}>
        {element}
      </Tooltip>
    );
  }

  return element;
}

export interface AdminRowActionsProps {
  /** Optional standard View action config */
  view?: AdminRowActionConfig | null | false;
  /** Optional standard Edit action config */
  edit?: AdminRowActionConfig | null | false;
  /** Optional standard Delete action config */
  delete?: AdminRowActionConfig | null | false;
  /** Optional arbitrary custom or module-specific action buttons (rendered between Edit and Delete) */
  extra?: ReactNode;
  /** Horizontal alignment: 'left' (default), 'center', or 'right' */
  align?: "left" | "center" | "right";
  /** Stop click event propagation to parent row (default true) */
  stopPropagation?: boolean;
  /** Additional container styling */
  className?: string;
}

/**
 * Standardized Admin Row Actions Component.
 *
 * Provides consistent icon choices (Eye, Pencil, Trash2), sizing (h-7 w-7),
 * theme borders, hover colors, tooltips, and ordering (View → Edit → Extra → Delete).
 */
export function AdminRowActions({
  view,
  edit,
  delete: deleteAction,
  extra,
  align = "left",
  stopPropagation = true,
  className,
}: AdminRowActionsProps) {
  const hasAnyAction = Boolean(
    (view && view.show !== false) ||
    (edit && edit.show !== false) ||
    (deleteAction && deleteAction.show !== false) ||
    extra
  );

  if (!hasAnyAction) return null;

  const alignClass =
    align === "right"
      ? "justify-end"
      : align === "center"
      ? "justify-center"
      : "justify-start";

  return (
    <div
      className={cn("flex items-center gap-1.5 whitespace-nowrap", alignClass, className)}
      onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
    >
      {/* 1. VIEW ACTION */}
      {view && view.show !== false && (
        <AdminActionButton
          action={view}
          defaultIcon={<Eye size={13} />}
          defaultTitle="View details"
          variant="default"
        />
      )}

      {/* 2. EDIT ACTION */}
      {edit && edit.show !== false && (
        <AdminActionButton
          action={edit}
          defaultIcon={<Pencil size={13} />}
          defaultTitle="Edit"
          variant="default"
        />
      )}

      {/* 3. CUSTOM / MODULE-SPECIFIC EXTRA ACTIONS */}
      {extra}

      {/* 4. DELETE ACTION */}
      {deleteAction && deleteAction.show !== false && (
        <AdminActionButton
          action={deleteAction}
          defaultIcon={<Trash2 size={13} />}
          defaultTitle="Delete"
          variant="danger"
        />
      )}
    </div>
  );
}

/**
 * Helper to construct a standardized Actions column for DataTable definitions.
 */
export function createActionsColumn<T>(options: {
  key?: string;
  label?: ReactNode;
  width?: string;
  align?: "left" | "center" | "right";
  render: (row: T) => ReactNode;
}) {
  return {
    key: options.key || "actions",
    label: options.label ?? "Actions",
    width: options.width || "100px",
    align: options.align || "right",
    render: options.render,
  };
}
