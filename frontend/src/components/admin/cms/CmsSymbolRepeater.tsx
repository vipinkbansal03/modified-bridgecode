"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { AdminInput, AdminTextarea } from "@/components/admin/AdminComponents";
import { CmsIconPicker, renderCmsIcon } from "./CmsIconPicker";
import { cn } from "@/utils/cn";

export interface SymbolItem {
  id?: string;
  icon?: string;
  title: string;
  description: string;
}

export interface CmsSymbolsValues {
  heading: string;
  introText?: string;
  symbols: SymbolItem[];
}

interface CmsSymbolRepeaterProps {
  values: CmsSymbolsValues;
  onChange: (next: CmsSymbolsValues) => void;
  headingLabel?: string;
  introLabel?: string;
}

export function CmsSymbolRepeater({
  values,
  onChange,
  headingLabel = "Section Heading",
  introLabel = "Introductory Text",
}: CmsSymbolRepeaterProps) {
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);
  const symbolRefs = useRef<(HTMLDivElement | null)[]>([]);
  const pendingScrollIndexRef = useRef<number | null>(null);

  useEffect(() => {
    if (pendingScrollIndexRef.current !== null) {
      const idx = pendingScrollIndexRef.current;
      pendingScrollIndexRef.current = null;
      const el = symbolRefs.current[idx];
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
  }, [values.symbols.length]);

  const handleHeadingChange = (heading: string) => {
    onChange({ ...values, heading });
  };

  const handleIntroChange = (introText: string) => {
    onChange({ ...values, introText });
  };

  const handleSymbolChange = (index: number, patch: Partial<SymbolItem>) => {
    const updatedSymbols = values.symbols.map((s, i) => (i === index ? { ...s, ...patch } : s));
    onChange({ ...values, symbols: updatedSymbols });
  };

  const handleAddSymbol = () => {
    const newSymbol: SymbolItem = {
      icon: "Hash",
      title: "New Symbol",
      description: "Symbol description...",
    };
    pendingScrollIndexRef.current = values.symbols.length;
    onChange({ ...values, symbols: [...values.symbols, newSymbol] });
  };

  const handleDeleteSymbol = (index: number) => {
    const updatedSymbols = values.symbols.filter((_, i) => i !== index);
    onChange({ ...values, symbols: updatedSymbols });
  };

  const handleMove = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= values.symbols.length) return;
    const updatedSymbols = [...values.symbols];
    const [moved] = updatedSymbols.splice(index, 1);
    updatedSymbols.splice(targetIndex, 0, moved);
    onChange({ ...values, symbols: updatedSymbols });
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AdminInput
          label={headingLabel}
          placeholder="e.g. Product label symbols"
          value={values.heading || ""}
          onChange={(e) => handleHeadingChange(e.target.value)}
          required
        />

        <AdminInput
          label={introLabel}
          placeholder="e.g. A quick reference for the most common symbols..."
          value={values.introText || ""}
          onChange={(e) => handleIntroChange(e.target.value)}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-[13px] font-semibold text-[#1A1A1A]">
            Product Label Symbols ({values.symbols.length})
          </label>
        </div>

        {values.symbols.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-gray-200 p-6 text-center text-sm text-gray-400">
            No symbols listed. Click &quot;Add Symbol&quot; below to add one.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {values.symbols.map((sym, idx) => (
              <div
                key={sym.id || `sym-${idx}`}
                ref={(el) => {
                  symbolRefs.current[idx] = el;
                }}
                className={cn(
                  "rounded-lg border border-[#E6E6E6] bg-gray-50/50 p-3.5 space-y-2.5 transition-all duration-300 hover:shadow-xs",
                  highlightedIndex === idx && "ring-2 ring-[#E31E24]/70 border-[#E31E24] shadow-md bg-red-50/20"
                )}
              >
                {/* Header with quick icon and title */}
                <div className="flex items-center justify-between gap-2 border-b border-gray-200 pb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[#E31E24] shrink-0">
                      {renderCmsIcon(sym.icon || "Hash", 15)}
                    </span>
                    <span className="text-[13px] font-semibold text-[#1A1A1A] truncate">
                      {idx + 1}. {sym.title || "(Untitled)"}
                    </span>
                  </div>

                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMove(idx, "up")}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move Up"
                    >
                      <ArrowUp size={13} />
                    </button>
                    <button
                      type="button"
                      disabled={idx === values.symbols.length - 1}
                      onClick={() => handleMove(idx, "down")}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Move Down"
                    >
                      <ArrowDown size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSymbol(idx)}
                      className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors ml-0.5"
                      title="Delete Symbol"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="sm:col-span-1">
                    <CmsIconPicker
                      label="Icon"
                      value={sym.icon || "Hash"}
                      onChange={(icon) => handleSymbolChange(idx, { icon })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <AdminInput
                      label="Symbol Title / Mark"
                      placeholder="e.g. Catalog Number"
                      value={sym.title || ""}
                      onChange={(e) => handleSymbolChange(idx, { title: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <AdminTextarea
                  label="Meaning / Usage Guidance"
                  placeholder="Precedes the part number..."
                  rows={2}
                  value={sym.description || ""}
                  onChange={(e) => handleSymbolChange(idx, { description: e.target.value })}
                  required
                />
              </div>
            ))}
          </div>
        )}

        {/* Add Symbol Button at Bottom */}
        <button
          type="button"
          onClick={handleAddSymbol}
          className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 hover:border-[#E31E24] bg-white hover:bg-red-50/20 py-2.5 px-4 text-[13px] font-semibold text-[#1A1A1A] hover:text-[#E31E24] transition-all shadow-2xs group"
        >
          <Plus size={15} className="text-[#E31E24] group-hover:scale-110 transition-transform" />
          <span>Add Symbol</span>
        </button>
      </div>
    </div>
  );
}
