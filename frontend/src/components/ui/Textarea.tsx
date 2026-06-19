import { forwardRef } from "react";
import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/utils/cn";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  touched?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, touched, className, id, rows = 5, ...rest }, ref) => {
    const showError = Boolean(touched && error);
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wide text-steel-2">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={id}
          rows={rows}
          className={cn(
            "w-full rounded-md border bg-white px-4 py-3 text-[14.5px] text-ink outline-none transition-colors placeholder:text-steel-2 resize-none",
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
Textarea.displayName = "Textarea";
