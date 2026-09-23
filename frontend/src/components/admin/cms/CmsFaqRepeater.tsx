"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown, GripVertical } from "lucide-react";
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
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [activeHandleIndex, setActiveHandleIndex] = useState<number | null>(null);
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
      const updated = [...values.items];
      const [moved] = updated.splice(draggedIndex, 1);
      updated.splice(targetIndex, 0, moved);
      onChange({ ...values, items: updated });
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
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
                draggable={activeHandleIndex === idx}
                onDragStart={(e) => {
                  if (activeHandleIndex !== idx) {
                    e.preventDefault();
                    return;
                  }
                  handleDragStart(e, idx);
                }}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragLeave={(e) => handleDragLeave(e, idx)}
                onDrop={(e) => {
                  setActiveHandleIndex(null);
                  handleDrop(e, idx);
                }}
                onDragEnd={() => {
                  setActiveHandleIndex(null);
                  handleDragEnd();
                }}
                className={cn(
                  "rounded-lg border bg-gray-50/50 p-4 space-y-3 transition-all duration-200",
                  draggedIndex === idx && "opacity-40 border-dashed border-[#E31E24] scale-[0.99]",
                  dragOverIndex === idx && draggedIndex !== idx && "border-[#E31E24] ring-2 ring-red-200 bg-red-50/20 shadow-sm",
                  draggedIndex === null && dragOverIndex === null && "border-[#E6E6E6] hover:border-gray-300",
                  highlightedIndex === idx && "ring-2 ring-[#E31E24]/70 border-[#E31E24] shadow-md bg-red-50/20"
                )}
              >
                <div className="flex items-center justify-between gap-2 border-b border-gray-200 pb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="flex items-center text-gray-400 hover:text-gray-700 cursor-grab active:cursor-grabbing p-1 rounded hover:bg-gray-200/60 transition-colors shrink-0"
                      title="Drag to reorder FAQ"
                      onMouseDown={() => setActiveHandleIndex(idx)}
                      onMouseUp={() => setActiveHandleIndex(null)}
                      onMouseLeave={() => setActiveHandleIndex(null)}
                    >
                      <GripVertical size={16} />
                    </div>
                    <span className="text-[13.5px] font-semibold text-[#1A1A1A] truncate">
                      Q{idx + 1}: {item.question || "(Untitled Question)"}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMove(idx, "up")}
                      className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      title="Move Up"
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      disabled={idx === values.items.length - 1}
                      onClick={() => handleMove(idx, "down")}
                      className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-200/60 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      title="Move Down"
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteFaq(idx)}
                      className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded ml-1 transition-colors cursor-pointer"
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
