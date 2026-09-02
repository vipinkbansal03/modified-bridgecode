"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import { cn } from "@/utils/cn";

export interface ShareButtonProps {
  title?: string;
  url?: string;
  className?: string;
  iconSize?: number;
}

export function ShareButton({
  title,
  url,
  className,
  iconSize = 16,
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast();

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const shareUrl = url || (typeof window !== "undefined" ? window.location.href : "");
    const shareTitle = title || (typeof document !== "undefined" ? document.title : "Modern Orthodontics");

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: `Check out ${shareTitle} on Modern Orthodontics`,
          url: shareUrl,
        });
        return;
      } catch (err: any) {
        if (err?.name === "AbortError") {
          return;
        }
      }
    }

    try {
      if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        showToast("Product link copied to clipboard!", "success");
        setTimeout(() => setCopied(false), 2000);
      } else if (typeof document !== "undefined") {
        const textarea = document.createElement("textarea");
        textarea.value = shareUrl;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        setCopied(true);
        showToast("Product link copied to clipboard!", "success");
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      showToast("Unable to copy link to clipboard.", "error");
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      aria-label="Share product"
      title={copied ? "Link copied!" : "Share product"}
      className={cn(
        "inline-flex items-center justify-center rounded-full p-1.5 text-steel hover:text-brand hover:bg-[#F3F4F6] transition-all active:scale-95",
        copied && "text-emerald-600 hover:text-emerald-600 bg-emerald-50",
        className
      )}
    >
      {copied ? <Check size={iconSize} className="stroke-[2.5]" /> : <Share2 size={iconSize} />}
    </button>
  );
}
