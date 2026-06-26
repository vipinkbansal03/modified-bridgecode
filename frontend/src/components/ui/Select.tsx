import { forwardRef } from "react";
import type { SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/utils/cn";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  touched?: boolean;
  options: SelectOption[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, touched, options, className, id, ...rest }, ref) => {
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
        <div className="relative">
          <select
            ref={ref}
            id={id}
            className={cn(
              "w-full appearance-none rounded-md border bg-white/80 px-4 py-3 pr-10 text-[14px] text-[#1A1A1A] outline-none transition-colors",
              showError
                ? "border-[#E31E24]"
                : "border-[#E0E0E0] focus:border-[#1A1A1A]",
              className
            )}
            {...rest}
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={16}
            className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#9A9A9A]"
          />
        </div>
        {showError && <span className="text-xs text-[#E31E24]">{error}</span>}
      </div>
    );
  }
);
Select.displayName = "Select";
