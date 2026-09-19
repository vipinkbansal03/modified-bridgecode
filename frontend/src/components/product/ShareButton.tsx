"use client";

import { useState, useEffect } from "react";
import { Share2, Check, Copy, Mail } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/ToastProvider";
import { cn } from "@/utils/cn";

export interface ShareButtonProps {
  title?: string;
  url?: string;
  image?: string;
  description?: string;
  className?: string;
  iconSize?: number;
  showText?: boolean;
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.301-.15-1.78-.879-2.056-.98-.276-.1-.477-.15-.678.15-.2.301-.777.98-.953 1.181-.176.201-.351.226-.652.076-.301-.15-1.272-.469-2.423-1.496-.896-.799-1.501-1.787-1.677-2.088-.176-.301-.019-.464.132-.614.136-.135.301-.351.452-.527.15-.176.201-.301.301-.502.1-.201.05-.377-.025-.527-.075-.15-.678-1.635-.929-2.239-.244-.588-.493-.509-.678-.518l-.578-.01c-.201 0-.527.075-.803.377s-1.054 1.03-1.054 2.512 1.079 2.913 1.23 3.114c.15.201 2.123 3.242 5.144 4.547.719.311 1.28.497 1.718.636.722.23 1.379.197 1.9.119.58-.088 1.78-.728 2.03-1.431.251-.703.251-1.306.176-1.431-.075-.126-.276-.201-.577-.351zM12.004 2C6.48 2 2 6.48 2 12.004c0 1.954.56 3.778 1.53 5.32L2.25 21.75l4.572-1.23c1.488.89 3.228 1.484 5.182 1.484 5.524 0 10.004-4.48 10.004-10.004C22.008 6.48 17.528 2 12.004 2zm0 18.172c-1.657 0-3.197-.478-4.502-1.3l-.323-.203-2.714.73.743-2.646-.222-.353A8.136 8.136 0 0 1 3.832 12c0-4.505 3.667-8.172 8.172-8.172s8.172 3.667 8.172 8.172-3.667 8.172-8.172 8.172z" />
    </svg>
  );
}

function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9v8.37H9.2V10.9H6.46M7.83 6.45a1.64 1.64 0 1 0 0 3.28 1.64 1.64 0 0 0 0-3.28z" />
    </svg>
  );
}

function TwitterXIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

export function ShareButton({
  title,
  url,
  image,
  description,
  className,
  iconSize = 16,
  showText = true,
}: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(url || "");
  const [canNativeShare, setCanNativeShare] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    if (!url && typeof window !== "undefined") {
      setCurrentUrl(window.location.href);
    } else if (url) {
      setCurrentUrl(url);
    }
  }, [url]);

  useEffect(() => {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      setCanNativeShare(true);
    }
  }, []);

  const shareTitle = title || (typeof document !== "undefined" ? document.title : "Modern Orthodontics");
  const shareUrl = currentUrl || (typeof window !== "undefined" ? window.location.href : "");

  const handleCopyLink = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else if (typeof document !== "undefined") {
        const textarea = document.createElement("textarea");
        textarea.value = shareUrl;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopied(true);
      showToast("Product link copied to clipboard!", "success");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      showToast("Unable to copy link to clipboard.", "error");
    }
  };

  const openShareUrl = (targetUrl: string) => {
    if (typeof window !== "undefined") {
      window.open(targetUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: `Check out ${shareTitle} on Modern Orthodontics`,
          url: shareUrl,
        });
        setOpen(false);
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          showToast("Share cancelled", "info");
        }
      }
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label="Share Product"
        title="Share Product"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-medium text-steel hover:text-brand hover:bg-[#F3F4F6] transition-all active:scale-95 cursor-pointer",
          className
        )}
      >
        <Share2 size={iconSize} />
        {showText && <span>Share Product</span>}
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Share Product"
        subtitle="Share this product with colleagues or across your network"
        size="sm"
        hideFooter
        panelClassName="max-w-md"
      >
        <div className="p-5 sm:p-6 space-y-5">
          {/* Product preview summary card */}
          <div className="flex items-center gap-3 p-3 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB]">
            {image && (
              <img
                src={image}
                alt={shareTitle}
                className="w-12 h-12 rounded object-contain border border-[#E5E7EB] bg-white shrink-0 p-1"
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-semibold text-[#1A1A1A] line-clamp-1">
                {shareTitle}
              </div>
              <div className="text-[11.5px] text-[#6B7280] truncate mt-0.5 font-mono">
                {shareUrl}
              </div>
            </div>
          </div>

          {/* Social share options */}
          <div>
            <p className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider mb-2.5">
              Share directly to
            </p>
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2.5">
              {/* WhatsApp */}
              <button
                type="button"
                onClick={() =>
                  openShareUrl(
                    `https://api.whatsapp.com/send?text=${encodeURIComponent(
                      `${shareTitle}\n${shareUrl}`
                    )}`
                  )
                }
                className="flex flex-col items-center justify-center p-2.5 rounded-xl border border-[#E5E7EB] hover:border-[#25D366] hover:bg-[#25D366]/5 transition-all group cursor-pointer text-center"
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[#25D366]/10 text-[#25D366] group-hover:bg-[#25D366] group-hover:text-white transition-colors">
                  <WhatsAppIcon className="w-5 h-5" />
                </div>
                <span className="mt-1.5 text-[11px] font-medium text-[#4B5563] group-hover:text-[#1A1A1A] truncate max-w-full">
                  WhatsApp
                </span>
              </button>

              {/* LinkedIn */}
              <button
                type="button"
                onClick={() =>
                  openShareUrl(
                    `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
                      shareUrl
                    )}`
                  )
                }
                className="flex flex-col items-center justify-center p-2.5 rounded-xl border border-[#E5E7EB] hover:border-[#0A66C2] hover:bg-[#0A66C2]/5 transition-all group cursor-pointer text-center"
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[#0A66C2]/10 text-[#0A66C2] group-hover:bg-[#0A66C2] group-hover:text-white transition-colors">
                  <LinkedinIcon className="w-5 h-5" />
                </div>
                <span className="mt-1.5 text-[11px] font-medium text-[#4B5563] group-hover:text-[#1A1A1A] truncate max-w-full">
                  LinkedIn
                </span>
              </button>

              {/* X / Twitter */}
              <button
                type="button"
                onClick={() =>
                  openShareUrl(
                    `https://twitter.com/intent/tweet?url=${encodeURIComponent(
                      shareUrl
                    )}&text=${encodeURIComponent(shareTitle)}`
                  )
                }
                className="flex flex-col items-center justify-center p-2.5 rounded-xl border border-[#E5E7EB] hover:border-black hover:bg-black/5 transition-all group cursor-pointer text-center"
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-black/10 text-black group-hover:bg-black group-hover:text-white transition-colors">
                  <TwitterXIcon className="w-4 h-4" />
                </div>
                <span className="mt-1.5 text-[11px] font-medium text-[#4B5563] group-hover:text-[#1A1A1A] truncate max-w-full">
                  X
                </span>
              </button>

              {/* Facebook */}
              <button
                type="button"
                onClick={() =>
                  openShareUrl(
                    `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
                      shareUrl
                    )}`
                  )
                }
                className="flex flex-col items-center justify-center p-2.5 rounded-xl border border-[#E5E7EB] hover:border-[#1877F2] hover:bg-[#1877F2]/5 transition-all group cursor-pointer text-center"
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[#1877F2]/10 text-[#1877F2] group-hover:bg-[#1877F2] group-hover:text-white transition-colors">
                  <FacebookIcon className="w-5 h-5" />
                </div>
                <span className="mt-1.5 text-[11px] font-medium text-[#4B5563] group-hover:text-[#1A1A1A] truncate max-w-full">
                  Facebook
                </span>
              </button>

              {/* Email */}
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.location.href = `mailto:?subject=${encodeURIComponent(
                      shareTitle
                    )}&body=${encodeURIComponent(
                      `Check out this product on Modern Orthodontics:\n\n${shareTitle}\n${shareUrl}`
                    )}`;
                  }
                }}
                className="flex flex-col items-center justify-center p-2.5 rounded-xl border border-[#E5E7EB] hover:border-[#EA4335] hover:bg-[#EA4335]/5 transition-all group cursor-pointer text-center"
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-[#EA4335]/10 text-[#EA4335] group-hover:bg-[#EA4335] group-hover:text-white transition-colors">
                  <Mail className="w-5 h-5" />
                </div>
                <span className="mt-1.5 text-[11px] font-medium text-[#4B5563] group-hover:text-[#1A1A1A] truncate max-w-full">
                  Email
                </span>
              </button>

              {/* Native Device Share (if supported) */}
              {canNativeShare && (
                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="flex flex-col items-center justify-center p-2.5 rounded-xl border border-[#E5E7EB] hover:border-brand hover:bg-brand/5 transition-all group cursor-pointer text-center"
                >
                  <div className="w-10 h-10 rounded-full flex items-center justify-center bg-brand/10 text-brand group-hover:bg-brand group-hover:text-white transition-colors">
                    <Share2 className="w-5 h-5" />
                  </div>
                  <span className="mt-1.5 text-[11px] font-medium text-[#4B5563] group-hover:text-[#1A1A1A] truncate max-w-full">
                    More Apps
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Copy link section */}
          <div>
            <label className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider block mb-2">
              Or copy link
            </label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1 min-w-0">
                <input
                  type="text"
                  readOnly
                  value={shareUrl}
                  onFocus={(e) => e.target.select()}
                  className="w-full pl-3 pr-3 py-2 text-[12.5px] font-mono text-[#374151] bg-[#F9FAFB] border border-[#D1D5DB] rounded-lg focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand select-all"
                />
              </div>
              <button
                type="button"
                onClick={handleCopyLink}
                className={cn(
                  "shrink-0 inline-flex items-center justify-center gap-1.5 px-4 py-2 text-[12.5px] font-semibold rounded-lg transition-all cursor-pointer",
                  copied
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-300"
                    : "bg-[#0B2545] text-white hover:bg-[#061527] shadow-xs"
                )}
              >
                {copied ? (
                  <>
                    <Check size={14} className="stroke-[2.5]" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    Copy
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
