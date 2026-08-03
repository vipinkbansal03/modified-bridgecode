"use client";

import { useFormik } from "formik";
import { ArrowRight, Check } from "lucide-react";
import { useNewsletterSubmit } from "@/hooks/api/useNewsletterSubmit";
import {
  newsletterInitialValues,
  newsletterValidationSchema,
} from "@/validations/newsletter.validation";
import { cn } from "@/utils/cn";

import { useToast } from "@/components/ui/ToastProvider";

interface NewsletterFormProps {
  /** Use "light" on dark backgrounds (e.g. the red footer) and "dark" elsewhere. */
  tone?: "light" | "dark";
}

export function NewsletterForm({ tone = "light" }: NewsletterFormProps) {
  const { mutate, isPending, isSuccess } = useNewsletterSubmit();
  const { showToast } = useToast();

  const formik = useFormik({
    initialValues: newsletterInitialValues,
    validationSchema: newsletterValidationSchema,
    onSubmit: (values, helpers) => {
      mutate(values, {
        onSuccess: (data) => {
          helpers.resetForm();
          if (data.alreadyActive) {
            showToast("You are already subscribed.", "info");
          } else {
            showToast("Successfully subscribed to the newsletter!", "success");
            localStorage.setItem("newsletter_subscribed", "true");
          }
        },
        onError: (err: any) => {
          showToast(err.message || "Failed to subscribe. Please try again.", "error");
        }
      });
    },
  });

  const isLight = tone === "light";

  return (
    <form onSubmit={formik.handleSubmit} noValidate>
      <div
        className={cn(
          "flex items-center rounded-pill border p-1 max-w-[320px]",
          isLight ? "border-white/45" : "border-line",
        )}
      >
        <input
          type="email"
          name="email"
          placeholder="Email*"
          required
          value={formik.values.email}
          onChange={formik.handleChange}
          className={cn(
            "min-w-0 flex-1 bg-transparent px-4 py-2 text-sm outline-none",
            isLight
              ? "text-white placeholder:text-white/60"
              : "text-ink placeholder:text-steel-2",
          )}
        />
        <button
          type="submit"
          aria-label="Subscribe"
          disabled={isPending}
          className={cn(
            "group flex h-8 w-8 flex-none items-center justify-center overflow-hidden rounded-full transition-opacity",
            isLight ? "bg-white" : "bg-brand",
            isPending && "opacity-60",
          )}
        >
          {isSuccess ? (
            <Check size={14} color={isLight ? "#E31E24" : "#fff"} />
          ) : (
            <span className="relative block h-4.5 w-4.5 overflow-hidden">
              <ArrowRight
                size={14}
                className={cn(
                  "absolute inset-0 transition-transform duration-500 ease-[cubic-bezier(.22,1,.36,1)] group-hover:translate-x-6",
                  isLight ? "text-brand" : "text-white",
                )}
              />

              <ArrowRight
                size={14}
                className={cn(
                  "absolute inset-0 -translate-x-6 transition-transform duration-500 ease-[cubic-bezier(.22,1,.36,1)] group-hover:translate-x-0",
                  isLight ? "text-brand" : "text-white",
                )}
              />
            </span>
          )}
        </button>
      </div>
      {formik.touched.email && formik.errors.email && (
        <p
          className={cn(
            "mt-2 text-xs",
            isLight ? "text-white/85" : "text-brand",
          )}
        >
          {formik.errors.email}
        </p>
      )}
    </form>
  );
}
