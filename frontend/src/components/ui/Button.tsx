import { forwardRef } from "react";
import type { ButtonHTMLAttributes, AnchorHTMLAttributes, ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/utils/cn";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "pillArrow";
export type ButtonSize = "sm" | "md" | "lg";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-brand text-white hover:bg-brand-deep border border-brand",
  secondary: "bg-ink text-white hover:bg-black border border-ink",
  outline: "bg-white text-ink border border-line hover:border-steel-2",
  ghost: "bg-transparent text-ink border border-transparent hover:bg-grey",
  pillArrow: "pill-cta",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-4 py-2 text-sm",
  md: "px-6 py-3 text-sm",
  lg: "px-7 py-3.5 text-[15px]",
};

interface SharedProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  children: ReactNode;
  className?: string;
}

type ButtonAsButton = SharedProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };

type ButtonAsLink = SharedProps &
  AnchorHTMLAttributes<HTMLAnchorElement> & { href: string };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

/**
 * Shared button/link component covering every CTA style used across the site.
 * `pillArrow` reproduces the signature "white pill + red circle arrow" CTA
 * (hero, about, get-in-touch); the rest are plain rounded-pill buttons for
 * forms and utility actions.
 */
export const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
  ({ variant = "primary", size = "md", fullWidth, className, children, ...rest }, ref) => {
    if (variant === "pillArrow") {
      const content = (
        <>
          <span>{children}</span>
          <span className="arrow">
            <ArrowRight size={16} color="#fff" strokeWidth={2} />
          </span>
        </>
      );
      if ("href" in rest && rest.href) {
        return (
          <a
            ref={ref as React.Ref<HTMLAnchorElement>}
            className={cn("pill-cta", fullWidth && "w-full justify-center", className)}
            {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}
          >
            {content}
          </a>
        );
      }
      return (
        <button
          ref={ref as React.Ref<HTMLButtonElement>}
          className={cn("pill-cta", fullWidth && "w-full justify-center", className)}
          {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}
        >
          {content}
        </button>
      );
    }

    const classes = cn(
      "inline-flex items-center justify-center gap-2 rounded-pill font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed",
      variantClasses[variant],
      sizeClasses[size],
      fullWidth && "w-full",
      className
    );

    if ("href" in rest && rest.href) {
      return (
        <a ref={ref as React.Ref<HTMLAnchorElement>} className={classes} {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}>
          {children}
        </a>
      );
    }

    return (
      <button ref={ref as React.Ref<HTMLButtonElement>} className={classes} {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}>
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
