"use client";

import { Modal } from "@/components/ui/Modal";
import MediaLibraryPanel from "@/components/admin/media/MediaLibraryPanel";
import type { MediaItem } from "@/services/mediaService";

export type MediaSelectorModalProps = {
  open?: boolean;
  isOpen?: boolean;
  value?: string;
  onClose: () => void;
  onSelect: (media: MediaItem) => void;
  title?: string;
  initialType?: "all" | "image" | "document";
  acceptTypes?: string[];
};

export function MediaSelectorModal({
  open,
  isOpen,
  value = "",
  onClose,
  onSelect,
  title = "Media Library",
  initialType = "image",
  acceptTypes,
}: MediaSelectorModalProps) {
  const isModalOpen = Boolean(open ?? isOpen);

  const resolvedInitialType: "all" | "image" | "document" = acceptTypes
    ? acceptTypes.includes("DOCUMENT") && !acceptTypes.includes("IMAGE")
      ? "document"
      : acceptTypes.includes("IMAGE") && !acceptTypes.includes("DOCUMENT")
        ? "image"
        : initialType
    : initialType;

  const handleSelect = (media: MediaItem) => {
    onSelect(media);
    onClose();
  };

  return (
    <Modal
      open={isModalOpen}
      onClose={onClose}
      title={title}
      size="3xl"
      bodyClassName="max-h-[80vh] overflow-y-auto p-4 sm:p-5"
      footer={
        <div className="flex items-center justify-end w-full">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-[#D1D5DB] bg-white px-6 py-2 text-[12px] font-bold tracking-wider text-[#4B5563] hover:text-[#1A1A1A] hover:bg-[#F9FAFB] transition-colors uppercase cursor-pointer"
          >
            Close
          </button>
        </div>
      }
    >
      <MediaLibraryPanel
        mode="select"
        value={value}
        initialType={resolvedInitialType}
        onSelect={handleSelect}
      />
    </Modal>
  );
}

export default MediaSelectorModal;
export type { MediaItem };
