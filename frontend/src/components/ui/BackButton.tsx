"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/utils/cn";

interface BackButtonProps {
  className?: string;
  label?: string;
  fallbackUrl?: string;
}

export function BackButton({
  className,
  label = "Back to Home",
  fallbackUrl = "/",
}: BackButtonProps) {
  const router = useRouter();

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(fallbackUrl);
    }
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#374151] shadow-2xs transition-colors hover:border-[#D1D5DB] hover:bg-[#F9FAFB] hover:text-[#111827] cursor-pointer",
        className
      )}
      aria-label="Go back"
    >
      <ArrowLeft size={14} className="text-[#E31E24]" />
      <span>{label}</span>
    </button>
  );
}