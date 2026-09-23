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
  multiple?: boolean;
  onSelectMultiple?: (mediaList: MediaItem[]) => void;
  title?: string;
  initialType?: "all" | "image" | "document" | "video";
  acceptTypes?: string[];
};

export function MediaSelectorModal({
  open,
  isOpen,
  value = "",
  onClose,
  onSelect,
  multiple = false,
  onSelectMultiple,
  title = "Media Library",
  initialType = "all",
  acceptTypes,
}: MediaSelectorModalProps) {
  const isModalOpen = Boolean(open ?? isOpen);

  const resolvedInitialType: "all" | "image" | "document" | "video" = acceptTypes
    ? acceptTypes.includes("DOCUMENT") && !acceptTypes.includes("IMAGE") && !acceptTypes.includes("VIDEO")
      ? "document"
      : acceptTypes.includes("VIDEO") && !acceptTypes.includes("IMAGE") && !acceptTypes.includes("DOCUMENT")
        ? "video"
        : acceptTypes.includes("IMAGE") && !acceptTypes.includes("DOCUMENT") && !acceptTypes.includes("VIDEO")
          ? "image"
          : initialType
    : initialType;

  const handleSelect = (media: MediaItem) => {
    onSelect(media);
    onClose();
  };

  const handleSelectMultiple = (mediaList: MediaItem[]) => {
    if (onSelectMultiple) {
      onSelectMultiple(mediaList);
    } else if (mediaList.length > 0) {
      onSelect(mediaList[0]);
    }
    onClose();
  };

  return (
    <Modal
      open={isModalOpen}
      onClose={onClose}
      title={title}
      size="4xl"
      bodyClassName="h-[82vh] max-h-[82vh] flex flex-col overflow-hidden p-3 sm:p-4"
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
        multiple={multiple}
        onSelectMultiple={handleSelectMultiple}
      />
    </Modal>
  );
}

export default MediaSelectorModal;
export type { MediaItem };
