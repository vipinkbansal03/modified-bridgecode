"use client";

import { useState } from "react";
import { Image as ImageIcon, FileText, Upload, X, Trash2, RefreshCw } from "lucide-react";
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

function getReadableAssetName(url: string): string {
  if (!url) return "";
  try {
    const cleanUrl = url.split("?")[0].split("#")[0];
    const rawName = cleanUrl.split("/").filter(Boolean).pop() || "";
    const decoded = decodeURIComponent(rawName);

    if (decoded.startsWith("photo-")) {
      return "External Photo Asset";
    }

    const strippedTimestamp = decoded.replace(/^\d{10,14}[-_]/, "");
    if (strippedTimestamp) {
      return strippedTimestamp;
    }

    return decoded || "Image Asset";
  } catch {
    return "Image Asset";
  }
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
  const readableName = getReadableAssetName(value);

  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && <label className="text-[13px] font-semibold text-[#1A1A1A]">{label}</label>}

      {value ? (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3.5 p-3 rounded-xl border border-gray-200 bg-white shadow-2xs">
          {/* Thumbnail & Info */}
          <div className="flex items-center gap-3.5 min-w-0 flex-1 w-full">
            <div className="h-15 w-15 sm:h-16 sm:w-16 shrink-0 rounded-lg overflow-hidden bg-gray-50 border border-gray-200 flex items-center justify-center relative shadow-2xs">
              {isDoc ? (
                <div className="flex flex-col items-center justify-center text-[#E31E24]">
                  <FileText size={24} />
                  <span className="text-[9px] font-semibold mt-0.5 text-gray-500">PDF</span>
                </div>
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={value} alt="Preview" className="h-full w-full object-cover" />
              )}
            </div>

            <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
                  {isDoc ? "Document attached" : "Image selected"}
                </span>
                <span className="text-[12.5px] font-medium text-gray-800 truncate" title={readableName}>
                  {readableName}
                </span>
              </div>

              {showUrlInput ? (
                <input
                  type="text"
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  disabled={disabled}
                  placeholder="Image URL..."
                  className="h-7.5 w-full px-2.5 rounded-md border border-gray-200 bg-gray-50/70 text-[11.5px] text-gray-600 focus:text-gray-900 focus:bg-white focus:border-[#E31E24] focus:outline-none transition-colors"
                />
              ) : (
                <p className="text-[11.5px] text-gray-400 truncate font-mono">{value}</p>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
            <button
              type="button"
              onClick={() => setOpen(true)}
              disabled={disabled}
              className="inline-flex items-center justify-center gap-1.5 h-8.5 px-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 hover:border-gray-300 text-[12px] font-semibold text-gray-700 hover:text-[#E31E24] transition-all shadow-2xs cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={13} className="text-gray-400" />
              <span>Change</span>
            </button>
            <button
              type="button"
              onClick={() => onChange("")}
              disabled={disabled}
              className="inline-flex items-center justify-center gap-1.5 h-8.5 px-3 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-[12px] font-semibold text-[#E31E24] transition-all shadow-2xs cursor-pointer disabled:opacity-50"
              title="Remove asset"
            >
              <Trash2 size={13} />
              <span>Remove</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            disabled={disabled}
            className="w-full flex flex-col items-center justify-center gap-1.5 p-4 rounded-xl border-2 border-dashed border-gray-200 bg-[#FAFAFA] hover:border-[#E31E24] hover:bg-red-50/10 transition-all cursor-pointer text-center disabled:opacity-50 disabled:cursor-not-allowed group"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white border border-gray-200 text-gray-500 group-hover:text-[#E31E24] group-hover:border-red-200 shadow-2xs transition-colors">
              {isDoc ? <FileText size={18} /> : <ImageIcon size={18} />}
            </span>
            <span className="text-[13px] font-semibold text-[#1A1A1A] group-hover:text-[#E31E24] transition-colors">
              {isDoc ? "Upload or Select Document" : "Upload or Select Image"}
            </span>
            <span className="text-[11.5px] text-gray-500">
              {hint || "Open Media Library to reuse existing assets or upload a new file"}
            </span>
          </button>

          {showUrlInput && (
            <div className="relative">
              <input
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                placeholder="Or paste an image URL directly..."
                className="h-9 w-full px-3 rounded-lg border border-gray-200 bg-white text-[12.5px] text-gray-800 placeholder:text-gray-400 focus:border-[#E31E24] focus:outline-none"
              />
            </div>
          )}
        </div>
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
