"use client";

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useId,
  type ReactNode,
  type ReactElement,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/utils/cn";

export interface TooltipProps {
  /** The content to display inside the tooltip */
  content: ReactNode;
  /** The target element that triggers the tooltip on hover / focus */
  children: ReactNode;
  /** Preferred placement side relative to trigger */
  side?: "top" | "bottom" | "left" | "right";
  /** Alignment along the placement axis */
  align?: "center" | "start" | "end";
  /** Distance in pixels from the trigger */
  sideOffset?: number;
  /** Delay in milliseconds before showing the tooltip on hover */
  delayDuration?: number;
  /** Disables the tooltip */
  disabled?: boolean;
  /** Additional styling for the tooltip bubble */
  className?: string;
  /** If true, forces tooltip to stay open */
  open?: boolean;
}

/**
 * Standardized Global Tooltip Component for Admin UI.
 *
 * Features:
 * - Minimalist, high-contrast dark theme (#111 with subtle border)
 * - Portal-rendered to prevent clipping by overflow-hidden containers / tables
 * - Smart viewport collision detection and repositioning
 * - Accessible with aria-describedby and role="tooltip"
 * - Snappy micro-interactions (default 120ms delay)
 * - Zero layout shift (attaches directly to trigger element ref)
 *
 * Example usage:
 * ```tsx
 * <Tooltip content="Edit Record">
 *   <button className="p-2">
 *     <Pencil size={14} />
 *   </button>
 * </Tooltip>
 * ```
 */
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? React.useLayoutEffect : React.useEffect;

export function Tooltip({
  content,
  children,
  side = "top",
  align = "center",
  sideOffset = 4,
  delayDuration = 120,
  disabled = false,
  className,
  open: controlledOpen,
}: TooltipProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: -9999, left: -9999 });
  const [mounted, setMounted] = useState(false);

  const isControlled = controlledOpen !== undefined;
  const isVisible = (isControlled ? controlledOpen : uncontrolledOpen) && !disabled && Boolean(content);

  const triggerRef = useRef<HTMLElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const tooltipId = useId();

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const calculatePosition = useCallback(() => {
    if (!triggerRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipEl = tooltipRef.current;
    const tooltipWidth = tooltipEl ? tooltipEl.offsetWidth : 80;
    const tooltipHeight = tooltipEl ? tooltipEl.offsetHeight : 22;

    let targetSide = side;
    let top = 0;
    let left = 0;

    // 1. Calculate side position with flip detection
    if (targetSide === "top") {
      top = triggerRect.top - tooltipHeight - sideOffset;
      if (top < 8 && triggerRect.bottom + tooltipHeight + sideOffset < window.innerHeight - 8) {
        targetSide = "bottom";
        top = triggerRect.bottom + sideOffset;
      }
    } else if (targetSide === "bottom") {
      top = triggerRect.bottom + sideOffset;
      if (top + tooltipHeight > window.innerHeight - 8 && triggerRect.top - tooltipHeight - sideOffset > 8) {
        targetSide = "top";
        top = triggerRect.top - tooltipHeight - sideOffset;
      }
    } else if (targetSide === "left") {
      left = triggerRect.left - tooltipWidth - sideOffset;
      if (left < 8 && triggerRect.right + tooltipWidth + sideOffset < window.innerWidth - 8) {
        targetSide = "right";
        left = triggerRect.right + sideOffset;
      }
    } else if (targetSide === "right") {
      left = triggerRect.right + sideOffset;
      if (left + tooltipWidth > window.innerWidth - 8 && triggerRect.left - tooltipWidth - sideOffset > 8) {
        targetSide = "left";
        left = triggerRect.left - tooltipWidth - sideOffset;
      }
    }

    // 2. Calculate alignment along cross-axis
    if (targetSide === "top" || targetSide === "bottom") {
      if (align === "start") {
        left = triggerRect.left;
      } else if (align === "end") {
        left = triggerRect.right - tooltipWidth;
      } else {
        left = triggerRect.left + (triggerRect.width - tooltipWidth) / 2;
      }
    } else {
      if (align === "start") {
        top = triggerRect.top;
      } else if (align === "end") {
        top = triggerRect.bottom - tooltipHeight;
      } else {
        top = triggerRect.top + (triggerRect.height - tooltipHeight) / 2;
      }
    }

    // 3. Viewport edge containment
    const padding = 8;
    left = Math.max(padding, Math.min(left, window.innerWidth - tooltipWidth - padding));
    top = Math.max(padding, Math.min(top, window.innerHeight - tooltipHeight - padding));

    setCoords({ top, left });
  }, [side, align, sideOffset]);

  // Recalculate on open, scroll, or resize
  useIsomorphicLayoutEffect(() => {
    if (!isVisible) return;

    calculatePosition();

    const handleUpdate = () => {
      calculatePosition();
    };

    window.addEventListener("scroll", handleUpdate, true);
    window.addEventListener("resize", handleUpdate);

    return () => {
      window.removeEventListener("scroll", handleUpdate, true);
      window.removeEventListener("resize", handleUpdate);
    };
  }, [isVisible, calculatePosition]);

  const handleMouseEnter = () => {
    if (disabled || isControlled) return;
    if (timerRef.current) clearTimeout(timerRef.current);

    if (delayDuration <= 0) {
      setUncontrolledOpen(true);
    } else {
      timerRef.current = setTimeout(() => {
        setUncontrolledOpen(true);
      }, delayDuration);
    }
  };

  const handleMouseLeave = () => {
    if (disabled || isControlled) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setUncontrolledOpen(false);
  };

  const handleFocus = () => {
    if (disabled || isControlled) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setUncontrolledOpen(true);
  };

  const handleBlur = () => {
    if (disabled || isControlled) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    setUncontrolledOpen(false);
  };

  // Clone single React element child or wrap in span if text/primitive
  const renderTrigger = () => {
    if (React.isValidElement(children)) {
      const child = children as ReactElement<Record<string, any>>;

      return React.cloneElement(child, {
        ref: (node: HTMLElement | null) => {
          triggerRef.current = node;
          const childRef = (child as any).ref;
          if (typeof childRef === "function") {
            childRef(node);
          } else if (childRef && "current" in childRef) {
            childRef.current = node;
          }
        },
        onMouseEnter: (e: React.MouseEvent) => {
          handleMouseEnter();
          child.props.onMouseEnter?.(e);
        },
        onMouseLeave: (e: React.MouseEvent) => {
          handleMouseLeave();
          child.props.onMouseLeave?.(e);
        },
        onFocus: (e: React.FocusEvent) => {
          handleFocus();
          child.props.onFocus?.(e);
        },
        onBlur: (e: React.FocusEvent) => {
          handleBlur();
          child.props.onBlur?.(e);
        },
        "aria-describedby": isVisible ? tooltipId : child.props["aria-describedby"],
      });
    }

    return (
      <span
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        aria-describedby={isVisible ? tooltipId : undefined}
        className="inline-flex"
      >
        {children}
      </span>
    );
  };

  return (
    <>
      {renderTrigger()}

      {mounted &&
        isVisible &&
        createPortal(
          <div
            ref={tooltipRef}
            id={tooltipId}
            role="tooltip"
            style={{
              position: "fixed",
              top: `${coords.top}px`,
              left: `${coords.left}px`,
            }}
            className={cn(
              "z-[999999] pointer-events-none select-none whitespace-nowrap",
              "rounded-md bg-[#111111] px-2 py-1 text-[11px] font-medium leading-tight text-white shadow-md border border-white/10",
              "animate-fade-in transition-opacity duration-150",
              className
            )}
          >
            {content}
          </div>,
          document.body
        )}
    </>
  );
}

export default Tooltip;
