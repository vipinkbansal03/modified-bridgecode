"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown, Upload, FileText } from "lucide-react";
import { AdminInput, AdminTextarea } from "@/components/admin/AdminComponents";
import { CmsIconPicker, renderCmsIcon } from "./CmsIconPicker";
import { uploadMediaFiles } from "@/utils/uploadMedia";
import { cn } from "@/utils/cn";
import type { CardRepeaterConfig } from "@/config/detailPageConfigs";

export interface CardItem {
  id?: string;
  icon?: string;
  title: string;
  subtitle?: string;
  description: string;
  linkLabel?: string;
  linkUrl?: string;
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
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const pendingScrollIndexRef = useRef<number | null>(null);

  const itemLabel = config?.itemLabel || "Card";
  const defaultIcon = config?.defaultIcon || "BadgeCheck";
  const allowIcon = config?.allowIcon ?? true;
  const allowLinks = config?.allowLinks ?? true;
  const allowFileUpload = config?.allowFileUpload ?? false;
  const allowParagraphs = config?.allowParagraphs ?? false;
  const allowSubtitle = config?.allowSubtitle ?? false;
  const subtitleLabel = config?.subtitleLabel || "Subtitle / Metric Label";
  const linkLabelDefault = config?.linkLabelDefault || "Learn more";

  useEffect(() => {
    if (pendingScrollIndexRef.current !== null) {
      const idx = pendingScrollIndexRef.current;
      pendingScrollIndexRef.current = null;
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
    onChange({ ...values, cards: updatedCards });
  };

  const handleFileUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    try {
      setUploadingIndex(index);
      const uploaded = await uploadMediaFiles(Array.from(files));
      if (uploaded && uploaded.length > 0 && uploaded[0]?.url) {
        handleCardChange(index, { linkUrl: uploaded[0].url });
      }
    } catch (err) {
      console.error(`Failed to upload ${itemLabel} document:`, err);
    } finally {
      setUploadingIndex(null);
      e.target.value = "";
    }
  };

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
        <div className="flex items-center justify-between">
          <label className="text-[13px] font-semibold text-[#1A1A1A]">
            {itemLabel}s Grid ({values.cards.length})
          </label>
        </div>

        {values.cards.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-[#8B8B8B]">
            No {itemLabel.toLowerCase()}s added yet. Click &quot;Add {itemLabel}&quot; below.
          </div>
        ) : (
          <div className="space-y-3">
            {values.cards.map((card, index) => (
              <div
                key={card.id || `card-${index}`}
                ref={(el) => {
                  cardRefs.current[index] = el;
                }}
                className={cn(
                  "rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-4 transition-all duration-300 hover:border-gray-300 space-y-3",
                  highlightedIndex === index && "ring-2 ring-[#E31E24]/70 border-[#E31E24] shadow-md bg-red-50/20"
                )}
              >
                <div className="flex items-center justify-between gap-2 border-b border-[#EDEDED] pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-[11px] font-bold text-gray-500 border border-gray-200">
                      {index + 1}
                    </span>
                    <div className="flex items-center gap-2">
                      {allowIcon && (
                        <span className="p-1 rounded bg-white border border-gray-200 text-[#E31E24]">
                          {renderCmsIcon(card.icon || defaultIcon, 16)}
                        </span>
                      )}
                      <span className="text-[13px] font-bold text-[#1A1A1A] truncate max-w-[280px]">
                        {card.title || `Untitled ${itemLabel}`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => handleMove(index, "up")}
                      className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move Up"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      disabled={index === values.cards.length - 1}
                      onClick={() => handleMove(index, "down")}
                      className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move Down"
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCard(index)}
                      className="p-1 text-gray-400 hover:text-red-600 ml-1 transition-colors"
                      title={`Delete ${itemLabel}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {allowIcon ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <CmsIconPicker
                        label="Icon"
                        value={card.icon || defaultIcon}
                        onChange={(newIcon) => handleCardChange(index, { icon: newIcon })}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <AdminInput
                        label={`${itemLabel} Title`}
                        placeholder={`e.g. ${card.title || "Title"}`}
                        value={card.title || ""}
                        onChange={(e) => handleCardChange(index, { title: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <AdminInput
                      label={`${itemLabel} Title`}
                      placeholder={`e.g. ${card.title || "Title"}`}
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

                <AdminTextarea
                  label="Description"
                  placeholder="Detailed description..."
                  rows={2}
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
                          <label className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-[#E31E24] hover:text-[#B5151B] cursor-pointer">
                            <Upload size={12} />
                            <span>{uploadingIndex === index ? "Uploading..." : "Upload File"}</span>
                            <input
                              type="file"
                              accept=".pdf,.doc,.docx,image/*"
                              className="hidden"
                              disabled={uploadingIndex === index}
                              onChange={(e) => handleFileUpload(index, e)}
                            />
                          </label>
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
            ))}
          </div>
        )}

        {/* Add Card Button at Bottom */}
        <button
          type="button"
          onClick={handleAddCard}
          className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 hover:border-[#E31E24] bg-white hover:bg-red-50/20 py-2.5 px-4 text-[13px] font-semibold text-[#1A1A1A] hover:text-[#E31E24] transition-all shadow-2xs group"
        >
          <Plus size={15} className="text-[#E31E24] group-hover:scale-110 transition-transform" />
          <span>Add {itemLabel}</span>
        </button>
      </div>
    </div>
  );
}
