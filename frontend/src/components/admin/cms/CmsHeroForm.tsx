"use client";

import { useState } from "react";
import Image from "next/image";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import { AdminInput, AdminTextarea } from "@/components/admin/AdminComponents";
import { uploadMediaFiles } from "@/utils/uploadMedia";
import { MediaSelectorModal } from "@/components/admin/media/MediaSelectorModal";

export interface CmsHeroValues {
  kicker?: string;
  title: string;
  description: string;
  image?: string;
}

interface CmsHeroFormProps {
  values: CmsHeroValues;
  onChange: (next: CmsHeroValues) => void;
  allowKicker?: boolean;
  allowImage?: boolean;
  kickerLabel?: string;
  titleLabel?: string;
  descriptionLabel?: string;
  imageLabel?: string;
}

export function CmsHeroForm({
  values,
  onChange,
  allowKicker = true,
  allowImage = true,
  kickerLabel = "Kicker / Eyebrow Text",
  titleLabel = "Main Page Heading",
  descriptionLabel = "Lead Description",
  imageLabel = "Hero Background Image",
}: CmsHeroFormProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [mediaModalOpen, setMediaModalOpen] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    try {
      setIsUploading(true);
      const uploaded = await uploadMediaFiles(Array.from(files));
      if (uploaded && uploaded.length > 0 && uploaded[0]?.url) {
        onChange({ ...values, image: uploaded[0].url });
      }
    } catch (err) {
      console.error("Failed to upload image:", err);
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-4">
      {allowKicker ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AdminInput
            label={kickerLabel}
            placeholder="e.g. Quality Certifications"
            value={values.kicker || ""}
            onChange={(e) => onChange({ ...values, kicker: e.target.value })}
          />

          <AdminInput
            label={titleLabel}
            placeholder="e.g. Certified to the standards global orthodontic brands require."
            required
            value={values.title || ""}
            onChange={(e) => onChange({ ...values, title: e.target.value })}
          />
        </div>
      ) : (
        <AdminInput
          label={titleLabel}
          placeholder="e.g. ALL PRODUCTS"
          required
          value={values.title || ""}
          onChange={(e) => onChange({ ...values, title: e.target.value })}
        />
      )}

      <AdminTextarea
        label={descriptionLabel}
        placeholder="Enter introductory paragraph describing the page focus..."
        rows={3}
        required
        value={values.description || ""}
        onChange={(e) => onChange({ ...values, description: e.target.value })}
      />

      {allowImage && (
        <div className="space-y-1.5 pt-1">
          <label className="block text-[13px] font-medium text-[#1A1A1A]">{imageLabel}</label>
          
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            {values.image ? (
              <div className="relative h-24 w-40 shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                <Image
                  src={values.image}
                  alt="Hero Preview"
                  fill
                  className="object-cover"
                  unoptimized
                />
                <button
                  type="button"
                  onClick={() => onChange({ ...values, image: "" })}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80 transition-colors"
                  title="Remove image"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <div className="flex h-24 w-40 shrink-0 flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 text-gray-400">
                <ImageIcon size={22} className="mb-1 text-gray-300" />
                <span className="text-[11px]">No Image Selected</span>
              </div>
            )}

            <div className="flex-1 space-y-2 w-full">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMediaModalOpen(true)}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-[#E31E24] px-3.5 py-1.5 text-[12.5px] font-semibold text-white hover:bg-[#B5151B] transition-colors shadow-2xs"
                >
                  <ImageIcon size={13} /> Browse Media Library
                </button>
                {values.image && (
                  <button
                    type="button"
                    onClick={() => onChange({ ...values, image: "" })}
                    className="text-[12.5px] text-red-600 hover:underline"
                  >
                    Remove Image
                  </button>
                )}
              </div>

              <AdminInput
                placeholder="Or paste an image URL (https://...)"
                value={values.image || ""}
                onChange={(e) => onChange({ ...values, image: e.target.value })}
                className="text-[12.5px] py-1.5"
              />
            </div>
          </div>
        </div>
      )}

      <MediaSelectorModal
        isOpen={mediaModalOpen}
        onClose={() => setMediaModalOpen(false)}
        onSelect={(media) => onChange({ ...values, image: media.url })}
        title="Select Hero Image"
        acceptTypes={["IMAGE"]}
      />
    </div>
  );
}
