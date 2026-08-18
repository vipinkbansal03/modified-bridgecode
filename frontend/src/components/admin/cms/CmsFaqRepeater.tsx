"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { AdminInput, AdminTextarea } from "@/components/admin/AdminComponents";
import { cn } from "@/utils/cn";

export interface FaqItem {
  id?: string;
  question: string;
  answer: string;
}

export interface CmsFaqsValues {
  heading?: string;
  items: FaqItem[];
}

interface CmsFaqRepeaterProps {
  values: CmsFaqsValues;
  onChange: (next: CmsFaqsValues) => void;
  headingLabel?: string;
  showHeading?: boolean;
}

export function CmsFaqRepeater({
  values,
  onChange,
  headingLabel = "FAQ Section Title",
  showHeading = false,
}: CmsFaqRepeaterProps) {
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const faqRefs = useRef<(HTMLDivElement | null)[]>([]);
  const pendingScrollIndexRef = useRef<number | null>(null);

  useEffect(() => {
    if (pendingScrollIndexRef.current !== null) {
      const idx = pendingScrollIndexRef.current;
      pendingScrollIndexRef.current = null;
      const el = faqRefs.current[idx];
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
  }, [values.items.length]);

  const handleHeadingChange = (heading: string) => {
    onChange({ ...values, heading });
  };

  const handleFaqChange = (index: number, patch: Partial<FaqItem>) => {
    const updated = values.items.map((item, i) => (i === index ? { ...item, ...patch } : item));
    onChange({ ...values, items: updated });
  };

  const handleAddFaq = () => {
    const newItem: FaqItem = {
      question: "Frequently asked question...",
      answer: "Answer to the question...",
    };
    pendingScrollIndexRef.current = values.items.length;
    onChange({ ...values, items: [...values.items, newItem] });
  };

  const handleDeleteFaq = (index: number) => {
    const updated = values.items.filter((_, i) => i !== index);
    onChange({ ...values, items: updated });
  };

  const handleMove = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= values.items.length) return;
    const updated = [...values.items];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    onChange({ ...values, items: updated });
  };

  return (
    <div className="space-y-4">
      {showHeading && (
        <AdminInput
          label={headingLabel}
          placeholder="e.g. Frequently Asked Questions"
          value={values.heading || ""}
          onChange={(e) => handleHeadingChange(e.target.value)}
        />
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-[13px] font-semibold text-[#1A1A1A]">
            FAQ Questions ({values.items.length})
          </label>
        </div>

        {values.items.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">
            No FAQ questions yet. Click &quot;Add FAQ Question&quot; below to add one.
          </div>
        ) : (
          <div className="space-y-3">
            {values.items.map((item, idx) => (
              <div
                key={item.id || `faq-${idx}`}
                ref={(el) => {
                  faqRefs.current[idx] = el;
                }}
                className={cn(
                  "rounded-lg border border-[#E6E6E6] bg-gray-50/50 p-4 space-y-3 transition-all duration-300 hover:shadow-xs",
                  highlightedIndex === idx && "ring-2 ring-[#E31E24]/70 border-[#E31E24] shadow-md bg-red-50/20"
                )}
              >
                <div className="flex items-center justify-between gap-2 border-b border-gray-200 pb-2">
                  <span className="text-[13.5px] font-semibold text-[#1A1A1A] truncate">
                    Q{idx + 1}: {item.question || "(Untitled Question)"}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMove(idx, "up")}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move Up"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      disabled={idx === values.items.length - 1}
                      onClick={() => handleMove(idx, "down")}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move Down"
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteFaq(idx)}
                      className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors ml-1"
                      title="Delete FAQ"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <AdminInput
                  label="Question"
                  placeholder="e.g. Is Modern Orthodontics ISO certified?"
                  value={item.question || ""}
                  onChange={(e) => handleFaqChange(idx, { question: e.target.value })}
                  required
                />

                <AdminTextarea
                  label="Answer"
                  placeholder="e.g. Yes — our quality management system is certified to ISO 13485:2016..."
                  rows={2}
                  value={item.answer || ""}
                  onChange={(e) => handleFaqChange(idx, { answer: e.target.value })}
                  required
                />
              </div>
            ))}
          </div>
        )}

        {/* Add FAQ Question Button at Bottom */}
        <button
          type="button"
          onClick={handleAddFaq}
          className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 hover:border-[#E31E24] bg-white hover:bg-red-50/20 py-2.5 px-4 text-[13px] font-semibold text-[#1A1A1A] hover:text-[#E31E24] transition-all shadow-2xs group"
        >
          <Plus size={15} className="text-[#E31E24] group-hover:scale-110 transition-transform" />
          <span>Add FAQ Question</span>
        </button>
      </div>
    </div>
  );
}
