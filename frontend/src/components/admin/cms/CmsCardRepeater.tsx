"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Upload,
  FileText,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Search,
  ChevronsUpDown,
  X,
} from "lucide-react";
import { AdminInput, AdminTextarea } from "@/components/admin/AdminComponents";
import ImageUploadField from "@/components/admin/ImageUploadField";
import { CmsIconPicker, renderCmsIcon } from "./CmsIconPicker";
import { uploadMediaFiles } from "@/utils/uploadMedia";
import { MediaSelectorModal } from "@/components/admin/media/MediaSelectorModal";
import { CmsSectionToggle } from "./CmsSectionToggle";
import { cn } from "@/utils/cn";
import type { CardRepeaterConfig } from "@/config/detailPageConfigs";

export interface CardItem {
  id?: string;
  icon?: string;
  image?: string;
  title: string;
  subtitle?: string;
  description: string;
  linkLabel?: string;
  linkUrl?: string;
  status?: "ACTIVE" | "INACTIVE";
}

export interface CmsCardsValues {
  heading: string;
  introText?: string;
  cards: CardItem[];
}

interface CmsCardRepeaterProps {
  values: CmsCardsValues;
  onChange: (next: CmsCardsValues) => void;
  headingLabel?: string;
  config?: CardRepeaterConfig;
}

export function CmsCardRepeater({
  values,
  onChange,
  headingLabel = "Section Heading",
  config,
}: CmsCardRepeaterProps) {
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [mediaModalIndex, setMediaModalIndex] = useState<number | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [activeHandleIndex, setActiveHandleIndex] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedIndices, setExpandedIndices] = useState<Record<number, boolean>>({});
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const pendingScrollIndexRef = useRef<number | null>(null);

  const itemLabel = config?.itemLabel || "Card";
  const defaultIcon = config?.defaultIcon || "BadgeCheck";
  const allowIcon = config?.allowIcon ?? true;
  const allowImage = config?.allowImage ?? false;
  const allowLinks = config?.allowLinks ?? true;
  const allowFileUpload = config?.allowFileUpload ?? false;
  const allowParagraphs = config?.allowParagraphs ?? false;
  const allowSubtitle = config?.allowSubtitle ?? false;
  const subtitleLabel = config?.subtitleLabel || "Subtitle / Metric Label";
  const linkLabelDefault = config?.linkLabelDefault || "Learn more";

  // When adding a new card, automatically expand and scroll to it
  useEffect(() => {
    if (pendingScrollIndexRef.current !== null) {
      const idx = pendingScrollIndexRef.current;
      pendingScrollIndexRef.current = null;
      setExpandedIndices((prev) => ({ ...prev, [idx]: true }));
      const el = cardRefs.current[idx];
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setHighlightedIndex(idx);
        setTimeout(() => {
          const input = el.querySelector("input:not([type='hidden']), textarea") as HTMLElement | null;
          input?.focus();
        }, 120);
        const timer = setTimeout(() => {
          setHighlightedIndex(null);
        }, 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [values.cards.length]);

  const toggleExpand = (index: number) => {
    setExpandedIndices((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const expandAll = () => {
    const all: Record<number, boolean> = {};
    values.cards.forEach((_, i) => {
      all[i] = true;
    });
    setExpandedIndices(all);
  };

  const collapseAll = () => {
    setExpandedIndices({});
  };

  const handleHeadingChange = (heading: string) => {
    onChange({ ...values, heading });
  };

  const handleIntroChange = (introText: string) => {
    onChange({ ...values, introText });
  };

  const handleCardChange = (index: number, patch: Partial<CardItem>) => {
    const updatedCards = values.cards.map((c, i) => (i === index ? { ...c, ...patch } : c));
    onChange({ ...values, cards: updatedCards });
  };

  const handleAddCard = () => {
    const newCard: CardItem = {
      icon: defaultIcon,
      title: `New ${itemLabel}`,
      description: "",
      linkLabel: allowLinks ? linkLabelDefault : undefined,
      linkUrl: allowLinks ? "" : undefined,
      status: "ACTIVE",
    };
    pendingScrollIndexRef.current = values.cards.length;
    onChange({ ...values, cards: [...values.cards, newCard] });
  };

  const handleDeleteCard = (index: number) => {
    const updatedCards = values.cards.filter((_, i) => i !== index);
    onChange({ ...values, cards: updatedCards });
  };

  const handleMove = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= values.cards.length) return;
    const updatedCards = [...values.cards];
    const [moved] = updatedCards.splice(index, 1);
    updatedCards.splice(targetIndex, 0, moved);

    // Keep expanded states aligned with moved cards
    const newExpanded: Record<number, boolean> = {};
    updatedCards.forEach((_, i) => {
      if (i === targetIndex) {
        newExpanded[i] = Boolean(expandedIndices[index]);
      } else if (i === index) {
        newExpanded[i] = Boolean(expandedIndices[targetIndex]);
      } else {
        newExpanded[i] = Boolean(expandedIndices[i]);
      }
    });
    setExpandedIndices(newExpanded);

    onChange({ ...values, cards: updatedCards });
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", `${index}`);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = (_e: React.DragEvent<HTMLDivElement>, index: number) => {
    if (dragOverIndex === index) {
      setDragOverIndex(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== targetIndex) {
      const updatedCards = [...values.cards];
      const [moved] = updatedCards.splice(draggedIndex, 1);
      updatedCards.splice(targetIndex, 0, moved);
      onChange({ ...values, cards: updatedCards });
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Filter cards by search
  const filteredCardIndices = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return values.cards.map((_, i) => i);
    return values.cards
      .map((c, i) => {
        const match =
          c.title?.toLowerCase().includes(q) ||
          c.description?.toLowerCase().includes(q) ||
          c.subtitle?.toLowerCase().includes(q);
        return match ? i : -1;
      })
      .filter((i) => i !== -1);
  }, [values.cards, searchTerm]);

  const totalCards = values.cards.length;
  const isSearchActive = Boolean(searchTerm.trim());

  return (
    <div className="space-y-5">
      <AdminInput
        label={headingLabel}
        placeholder={`e.g. ${values.heading || headingLabel}`}
        value={values.heading || ""}
        onChange={(e) => handleHeadingChange(e.target.value)}
        required
      />

      {allowParagraphs && (
        <AdminTextarea
          label="Introductory Paragraph (Optional)"
          placeholder="Brief intro text before the grid..."
          rows={3}
          value={values.introText || ""}
          onChange={(e) => handleIntroChange(e.target.value)}
        />
      )}

      <div className="space-y-3">
        {/* Controls Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-1 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <label className="text-[13.5px] font-bold text-[#1A1A1A]">
              {itemLabel}s List ({totalCards})
            </label>
            {isSearchActive && (
              <span className="text-[11px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                Showing {filteredCardIndices.length} of {totalCards}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Search Input for fast filtering among 30+ items */}
            {totalCards > 3 && (
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={`Search ${itemLabel.toLowerCase()}s...`}
                  className="h-8 w-44 sm:w-56 pl-7 pr-7 rounded-lg border border-gray-200 bg-white text-[12px] text-gray-800 placeholder:text-gray-400 focus:border-[#E31E24] focus:outline-none transition-colors"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                    title="Clear filter"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            )}

            {totalCards > 1 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={expandAll}
                  className="px-2.5 py-1 text-[11.5px] font-semibold text-gray-600 hover:text-[#E31E24] hover:bg-gray-50 rounded border border-gray-200 transition-colors cursor-pointer"
                  title="Expand all items"
                >
                  Expand All
                </button>
                <button
                  type="button"
                  onClick={collapseAll}
                  className="px-2.5 py-1 text-[11.5px] font-semibold text-gray-600 hover:text-[#E31E24] hover:bg-gray-50 rounded border border-gray-200 transition-colors cursor-pointer"
                  title="Collapse all items"
                >
                  Collapse All
                </button>
              </div>
            )}
          </div>
        </div>

        {totalCards === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-[#8B8B8B]">
            No {itemLabel.toLowerCase()}s added yet. Click &quot;Add {itemLabel}&quot; below.
          </div>
        ) : filteredCardIndices.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-200 p-5 text-center text-xs text-gray-500">
            No {itemLabel.toLowerCase()}s match &quot;{searchTerm}&quot;.
          </div>
        ) : (
          <div className="space-y-2">
            {filteredCardIndices.map((index) => {
              const card = values.cards[index];
              if (!card) return null;
              const isCardActive = (card.status || "ACTIVE") === "ACTIVE";
              const isExpanded = Boolean(expandedIndices[index]);

              return (
                <div
                  key={card.id || `card-${index}`}
                  ref={(el) => {
                    cardRefs.current[index] = el;
                  }}
                  draggable={activeHandleIndex === index}
                  onDragStart={(e) => {
                    if (activeHandleIndex !== index) {
                      e.preventDefault();
                      return;
                    }
                    handleDragStart(e, index);
                  }}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={(e) => handleDragLeave(e, index)}
                  onDrop={(e) => {
                    setActiveHandleIndex(null);
                    handleDrop(e, index);
                  }}
                  onDragEnd={() => {
                    setActiveHandleIndex(null);
                    handleDragEnd();
                  }}
                  className={cn(
                    "rounded-xl border transition-all duration-200 overflow-hidden",
                    isCardActive ? "bg-white" : "bg-gray-50/80 border-dashed border-gray-300 opacity-90",
                    draggedIndex === index && "opacity-40 border-dashed border-[#E31E24] scale-[0.99]",
                    dragOverIndex === index && draggedIndex !== index && "border-[#E31E24] ring-2 ring-red-200 bg-red-50/20 shadow-sm",
                    draggedIndex === null && dragOverIndex === null && isCardActive && "border-[#E5E7EB] shadow-2xs hover:border-gray-300",
                    highlightedIndex === index && "ring-2 ring-[#E31E24]/70 border-[#E31E24] shadow-md bg-red-50/20"
                  )}
                >
                  {/* Collapsible Card Header Bar */}
                  <div
                    onClick={() => toggleExpand(index)}
                    className="flex cursor-pointer items-center justify-between gap-2.5 px-3.5 py-2.5 select-none hover:bg-gray-50/80 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      {/* Drag Handle */}
                      <div
                        className="flex items-center text-gray-400 hover:text-gray-700 cursor-grab active:cursor-grabbing p-1 rounded hover:bg-gray-200/60 transition-colors shrink-0"
                        title="Drag to reorder"
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={() => setActiveHandleIndex(index)}
                        onMouseUp={() => setActiveHandleIndex(null)}
                        onMouseLeave={() => setActiveHandleIndex(null)}
                      >
                        <GripVertical size={15} />
                      </div>

                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-[11px] font-bold text-gray-600 border border-gray-200 shadow-2xs shrink-0">
                        {index + 1}
                      </span>

                      {/* Mini Thumbnail / Avatar */}
                      {card.image ? (
                        <div className="h-7 w-7 rounded-full overflow-hidden border border-gray-200 bg-gray-50 shrink-0 shadow-2xs">
                          <img src={card.image} alt="" className="h-full w-full object-cover" />
                        </div>
                      ) : allowIcon && card.icon && card.icon !== "none" ? (
                        <span className="p-1 rounded-full bg-red-50 text-[#E31E24] shrink-0">
                          {renderCmsIcon(card.icon, 14)}
                        </span>
                      ) : (
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-50 text-[11.5px] font-bold text-[#E31E24] shrink-0">
                          {(card.title || "D").charAt(0)}
                        </span>
                      )}

                      <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                        <span className="text-[13.5px] font-bold text-[#1A1A1A] truncate max-w-[200px] sm:max-w-[240px]">
                          {card.title || `Untitled ${itemLabel}`}
                        </span>

                        {card.description && (
                          <span className="text-[12px] text-gray-500 truncate max-w-[280px] sm:max-w-[380px] hidden md:inline">
                            &quot;{card.description}&quot;
                          </span>
                        )}
                      </div>

                      {!isCardActive && (
                        <span className="text-[10px] font-semibold text-gray-500 bg-gray-200 border border-gray-300 px-1.5 py-0.5 rounded shrink-0">
                          Inactive
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <CmsSectionToggle
                        enabled={isCardActive}
                        onChange={(nextEnabled) =>
                          handleCardChange(index, { status: nextEnabled ? "ACTIVE" : "INACTIVE" })
                        }
                        label={isCardActive ? "Active" : "Inactive"}
                      />
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => handleMove(index, "up")}
                        className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        title="Move Up"
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        type="button"
                        disabled={index === values.cards.length - 1}
                        onClick={() => handleMove(index, "down")}
                        className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                        title="Move Down"
                      >
                        <ArrowDown size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCard(index)}
                        className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                        title={`Delete ${itemLabel}`}
                      >
                        <Trash2 size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleExpand(index)}
                        className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors cursor-pointer ml-0.5"
                        title={isExpanded ? "Collapse" : "Expand"}
                      >
                        {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </button>
                    </div>
                  </div>

                  {/* Expanded Card Editor Form */}
                  {isExpanded && (
                    <div className="p-4 pt-3 border-t border-[#EDEDED] bg-white space-y-3.5">
                      {allowIcon ? (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <CmsIconPicker
                              label="Icon (Optional with Image)"
                              value={card.icon || (card.image ? "none" : defaultIcon)}
                              onChange={(newIcon) => handleCardChange(index, { icon: newIcon })}
                              allowNone={true}
                            />
                          </div>
                          <div className="md:col-span-2">
                            <AdminInput
                              label={`${itemLabel} Title / Name`}
                              placeholder={`e.g. ${card.title || "Dr. John Doe"}`}
                              value={card.title || ""}
                              onChange={(e) => handleCardChange(index, { title: e.target.value })}
                              required
                            />
                          </div>
                        </div>
                      ) : (
                        <div>
                          <AdminInput
                            label={`${itemLabel} Title / Name`}
                            placeholder={`e.g. ${card.title || "Dr. John Doe"}`}
                            value={card.title || ""}
                            onChange={(e) => handleCardChange(index, { title: e.target.value })}
                            required
                          />
                        </div>
                      )}

                      {allowSubtitle && (
                        <AdminInput
                          label={subtitleLabel}
                          placeholder="e.g. Since 1994"
                          value={card.subtitle || ""}
                          onChange={(e) => handleCardChange(index, { subtitle: e.target.value })}
                        />
                      )}

                      {allowImage && (
                        <div className="pt-1">
                          <ImageUploadField
                            label={`${itemLabel} Avatar / Image`}
                            value={card.image || ""}
                            onChange={(url) => handleCardChange(index, { image: url })}
                            showUrlInput
                            title={`Select ${itemLabel} Image`}
                            hint="Upload or select the doctor photo from the Media Library"
                          />
                        </div>
                      )}

                      <AdminTextarea
                        label={`${itemLabel} Quote / Description`}
                        placeholder="Detailed clinical feedback or review quote..."
                        rows={3}
                        value={card.description || ""}
                        onChange={(e) => handleCardChange(index, { description: e.target.value })}
                        required
                      />

                      {allowLinks && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 border-t border-[#EDEDED]">
                          <AdminInput
                            label="Link / Button Label"
                            placeholder={`e.g. ${linkLabelDefault}`}
                            value={card.linkLabel || ""}
                            onChange={(e) => handleCardChange(index, { linkLabel: e.target.value })}
                          />

                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="block text-[12.5px] font-semibold text-[#1A1A1A]">
                                Destination URL / Document
                              </label>
                              {allowFileUpload && (
                                <button
                                  type="button"
                                  onClick={() => setMediaModalIndex(index)}
                                  className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-[#E31E24] hover:text-[#B5151B] cursor-pointer"
                                >
                                  <FileText size={12} />
                                  <span>Browse Media Library</span>
                                </button>
                              )}
                            </div>
                            <div className="relative">
                              <AdminInput
                                value={card.linkUrl || ""}
                                onChange={(e) => handleCardChange(index, { linkUrl: e.target.value })}
                                placeholder="https://... or /docs/file.pdf"
                              />
                              {card.linkUrl?.endsWith(".pdf") && (
                                <span
                                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400"
                                  title="PDF Document Attached"
                                >
                                  <FileText size={15} />
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Add Card Button at Bottom */}
        <button
          type="button"
          onClick={handleAddCard}
          className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 hover:border-[#E31E24] bg-white hover:bg-red-50/20 py-2.5 px-4 text-[13px] font-semibold text-[#1A1A1A] hover:text-[#E31E24] transition-all shadow-2xs group cursor-pointer"
        >
          <Plus size={15} className="text-[#E31E24] group-hover:scale-110 transition-transform" />
          <span>Add {itemLabel}</span>
        </button>
      </div>

      <MediaSelectorModal
        isOpen={mediaModalIndex !== null}
        onClose={() => setMediaModalIndex(null)}
        onSelect={(media) => {
          if (mediaModalIndex !== null) {
            handleCardChange(mediaModalIndex, { linkUrl: media.url });
          }
        }}
        title={`Select ${itemLabel} File or Document`}
        acceptTypes={["DOCUMENT", "IMAGE"]}
      />
    </div>
  );
}
