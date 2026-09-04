"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X, Loader2 } from "lucide-react";
import { cn } from "@/utils/cn";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  panelClassName?: string;
  bodyClassName?: string;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "full";
  // Built-in Action Buttons (matches reference popup)
  onSave?: () => void | Promise<void>;
  saveText?: string;
  cancelText?: string;
  isSaving?: boolean;
  isSaveDisabled?: boolean;
  saveVariant?: "primary" | "brand" | "navy" | "dark" | "danger";
  hideFooter?: boolean;
  hideCloseButton?: boolean;
  closeOnClickOutside?: boolean;
}

const sizeClasses: Record<string, string> = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-2xl",
  xl: "max-w-3xl",
  "2xl": "max-w-4xl",
  "3xl": "max-w-5xl",
  "4xl": "max-w-6xl",
  full: "max-w-[95vw]",
};

const saveVariantStyles: Record<string, string> = {
  primary: "bg-[#E31E24] hover:bg-[#B5151B] text-white shadow-xs",
  brand: "bg-[#E31E24] hover:bg-[#B5151B] text-white shadow-xs",
  navy: "bg-[#0B2545] hover:bg-[#061527] text-white shadow-xs",
  dark: "bg-[#1A1A1A] hover:bg-[#000000] text-white shadow-xs",
  danger: "bg-red-600 hover:bg-red-700 text-white shadow-xs",
};

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  panelClassName,
  bodyClassName,
  size = "md",
  onSave,
  saveText = "Save",
  cancelText = "Cancel",
  isSaving = false,
  isSaveDisabled = false,
  saveVariant = "primary",
  hideFooter = false,
  hideCloseButton = false,
  closeOnClickOutside = true,
}: ModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          onClose();
        }
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => {
        document.body.style.overflow = "";
        window.removeEventListener("keydown", handleKeyDown);
      };
    } else {
      document.body.style.overflow = "";
    }
  }, [open, onClose]);

  if (!mounted) return null;

  const hasActionButtons = Boolean(onSave);
  const showFooter = !hideFooter && (footer !== undefined || hasActionButtons);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/50 p-4 md:p-6 backdrop-blur-xs"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={closeOnClickOutside ? onClose : undefined}
        >
          <motion.div
            className={cn(
              "w-full bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh] md:max-h-[85vh] border border-[#E5E7EB] relative",
              sizeClasses[size] || "max-w-xl",
              panelClassName
            )}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            {(title || !hideCloseButton) && (
              <div className="flex items-center justify-between border-b border-[#F0F0F0] bg-white px-7 py-5 md:px-8 md:py-5.5 shrink-0">
                <div className="flex-1 min-w-0 pr-4">
                  {typeof title === "string" ? (
                    <h3 className="text-[18px] md:text-[20px] font-semibold text-[#1A1A1A] tracking-tight truncate">
                      {title}
                    </h3>
                  ) : (
                    title
                  )}
                  {subtitle && (
                    <p className="mt-1 text-[13px] text-[#6B7280] font-normal">
                      {subtitle}
                    </p>
                  )}
                </div>
                {!hideCloseButton && (
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="p-1.5 -mr-1 rounded-md text-[#9CA3AF] hover:text-[#E31E24] hover:bg-red-50/60 transition-colors cursor-pointer"
                  >
                    <X size={20} />
                  </button>
                )}
              </div>
            )}

            {/* Scrollable Body */}
            <div
              className={cn(
                "overflow-y-auto overflow-x-hidden relative flex-1 min-h-0 bg-white",
                bodyClassName
              )}
            >
              {children}
            </div>

            {/* Footer */}
            {showFooter && (
              <div className="flex items-center justify-end gap-3 border-t border-[#F0F0F0] bg-white px-7 py-4 md:px-8 md:py-4.5 shrink-0">
                {footer !== undefined ? (
                  footer
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={onClose}
                      className="rounded-md border border-[#D1D5DB] bg-white px-6 py-2.5 text-[12px] font-bold tracking-wider text-[#4B5563] hover:text-[#1A1A1A] hover:bg-[#F9FAFB] hover:border-[#9CA3AF] transition-colors uppercase cursor-pointer"
                    >
                      {cancelText}
                    </button>
                    {onSave && (
                      <button
                        type="button"
                        onClick={onSave}
                        disabled={isSaving || isSaveDisabled}
                        className={cn(
                          "flex items-center justify-center gap-2 rounded-md px-7 py-2.5 text-[12px] font-bold tracking-wider transition-colors uppercase disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer",
                          saveVariantStyles[saveVariant] || saveVariantStyles.primary
                        )}
                      >
                        {isSaving && <Loader2 size={14} className="animate-spin" />}
                        {saveText}
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
