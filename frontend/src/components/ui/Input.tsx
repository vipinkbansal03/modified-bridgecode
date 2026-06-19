import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";
import { cn } from "@/utils/cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  touched?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, touched, className, id, ...rest }, ref) => {
    const showError = Boolean(touched && error);
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wide text-steel-2">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={cn(
            "w-full rounded-md border bg-white px-4 py-3 text-[14.5px] text-ink outline-none transition-colors placeholder:text-steel-2",
            showError ? "border-brand" : "border-line focus:border-steel-2",
            className
          )}
          {...rest}
        />
        {showError && <span className="text-xs text-brand">{error}</span>}
      </div>
    );
  }
);
Input.displayName = "Input";
