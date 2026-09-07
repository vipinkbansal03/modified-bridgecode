"use client";

import { useState } from "react";
import { Image as ImageIcon, FileText, Upload, X } from "lucide-react";
import MediaSelectorModal from "@/components/admin/media/MediaSelectorModal";
import type { MediaItem } from "@/services/mediaService";

interface Props {
  label?: string;
  value: string;
  onChange: (url: string, media?: MediaItem) => void;
  showUrlInput?: boolean;
  disabled?: boolean;
  type?: "image" | "document" | "all";
  title?: string;
  hint?: string;
}

export default function ImageUploadField({
  label,
  value,
  onChange,
  showUrlInput = false,
  disabled = false,
  type = "image",
  title = "Media Library",
  hint,
}: Props) {
  const [open, setOpen] = useState(false);

  const handleSelect = (media: MediaItem) => {
    onChange(media.url, media);
    setOpen(false);
  };

  const isDoc = type === "document" || value?.toLowerCase().endsWith(".pdf");

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && <label className="text-[13px] font-medium text-[#1A1A1A]">{label}</label>}

      {value && (
        <div className="relative inline-flex items-center gap-3 p-2 rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] max-w-md">
          {isDoc ? (
            <div className="flex items-center gap-2.5 text-[#E31E24]">
              <FileText size={28} />
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] font-medium text-[#1A1A1A] truncate max-w-[220px]">
                  {value.split("/").pop()}
                </p>
                <span className="text-[11px] text-[#6B6B6B]">Document linked</span>
              </div>
            </div>
          ) : (
            <div className="h-16 w-16 shrink-0 rounded-md overflow-hidden bg-white border border-[#E6E6E6] flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={value} alt="Preview" className="h-full w-full object-cover" />
            </div>
          )}

          <button
            type="button"
            onClick={() => onChange("")}
            disabled={disabled}
            className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#E31E24] text-white hover:bg-[#B5151B] text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50"
            title="Remove"
          >
            <X size={12} />
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="flex flex-col items-center justify-center gap-1.5 p-4 rounded-xl border-2 border-dashed border-[#E6E6E6] bg-[#FAFAFA] hover:border-[#E31E24] hover:bg-[#FFF8F8] transition-all cursor-pointer text-center disabled:opacity-50 disabled:cursor-not-allowed group"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white border border-[#E6E6E6] text-[#6B6B6B] group-hover:text-[#E31E24] group-hover:border-[#E31E24]/30 shadow-2xs transition-colors">
          {isDoc ? <FileText size={18} /> : <ImageIcon size={18} />}
        </span>
        <span className="text-[13px] font-semibold text-[#1A1A1A] group-hover:text-[#E31E24] transition-colors">
          {value
            ? isDoc
              ? "Change Document"
              : "Change Image"
            : isDoc
            ? "Upload or Select Document"
            : "Upload or Select Image"}
        </span>
        <span className="text-[11.5px] text-[#6B6B6B]">
          {hint || "Open Media Library to reuse existing assets or upload a new file"}
        </span>
      </button>

      {showUrlInput && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="Or paste an image URL..."
          className="h-9 px-3 rounded-md border border-[#E6E6E6] bg-white text-[13px] text-[#1A1A1A] focus:border-[#E31E24] focus:outline-none"
        />
      )}

      <MediaSelectorModal
        open={disabled ? false : open}
        value={value}
        title={title}
        initialType={type}
        onClose={() => setOpen(false)}
        onSelect={handleSelect}
      />
    </div>
  );
}
