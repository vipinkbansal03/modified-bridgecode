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
          <label
            htmlFor={id}
            className="text-[13px] font-semibold text-[#1A1A1A]"
          >
            {label}
            {rest.required && (
              <span className="ml-0.5 text-[#E31E24]" aria-hidden="true">
                *
              </span>
            )}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={cn(
            "w-full rounded-md border bg-white/80 px-2 py-2 lg:px-4 lg:py-3 text-[14px] text-[#1A1A1A] outline-none transition-colors placeholder:text-[#9A9A9A]",
            showError
              ? "border-[#E31E24]"
              : "border-[#E0E0E0] focus:border-[#1A1A1A]",
            className
          )}
          {...rest}
        />
        {showError && <span className="text-xs text-[#E31E24]">{error}</span>}
      </div>
    );
  }
);
Input.displayName = "Input";
