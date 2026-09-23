"use client";

import { useState, useRef, useEffect } from "react";
import * as LucideIcons from "lucide-react";
import { ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/utils/cn";

export const COMMON_CMS_ICONS = [
  { name: "BadgeCheck", label: "Badge Check (ISO / Quality)" },
  { name: "ShieldCheck", label: "Shield Check (CE / Safety)" },
  { name: "Stamp", label: "Stamp (FDA / Registration)" },
  { name: "FlaskConical", label: "Flask / Beaker (MSDS / Materials)" },
  { name: "Globe", label: "Globe (MDSAP / Global Export)" },
  { name: "Hash", label: "Hash / Number (Catalog Number)" },
  { name: "Layers", label: "Layers (LOT / Batch Code)" },
  { name: "Factory", label: "Factory (Manufacturer)" },
  { name: "Ban", label: "Ban / Prohibit (Do Not Reuse)" },
  { name: "Hourglass", label: "Hourglass (Use By Date)" },
  { name: "BookOpen", label: "Book Open (Consult IFU)" },
  { name: "Sun", label: "Sun (Keep Away From Sunlight)" },
  { name: "TriangleAlert", label: "Warning Triangle (Nickel / Allergen)" },
  { name: "Stethoscope", label: "Stethoscope (Rx Only)" },
  { name: "Pyramid", label: "Pyramid (Brackets)" },
  { name: "CircleDot", label: "Circle Dot (Molar Bands)" },
  { name: "Disc", label: "Disc (Molar Tubes)" },
  { name: "Waves", label: "Waves (NiTi Wires)" },
  { name: "Spline", label: "Spline (SS & TMA Wires)" },
  { name: "Link2", label: "Link (Coated / Torqued Wires)" },
  { name: "PenTool", label: "Pen Tool (Design Software)" },
  { name: "Compass", label: "Compass (Engineering Precision)" },
  { name: "CheckCircle2", label: "Check Circle" },
  { name: "FileText", label: "File Document" },
  { name: "Building2", label: "Office / Facility" },
  { name: "Truck", label: "Truck / Shipping" },
];

export function renderCmsIcon(iconName?: string | null, size = 16, className = "") {
  if (!iconName || iconName === "none") return null;
  const iconsMap = LucideIcons as unknown as Record<string, React.ComponentType<{ size?: number; className?: string }>>;
  const IconComp = iconsMap[iconName];
  if (IconComp) return <IconComp size={size} className={className} />;
  return <LucideIcons.Circle size={size} className={className} />;
}

interface CmsIconPickerProps {
  value?: string | null;
  onChange: (iconName: string) => void;
  label?: string;
  allowNone?: boolean;
}

export function CmsIconPicker({ value, onChange, label, allowNone = true }: CmsIconPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedIcon = value || (allowNone ? "none" : "Circle");
  const isNone = selectedIcon === "none" || !selectedIcon;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const allIcons = allowNone
    ? [{ name: "none", label: "No Icon (Image or text only)" }, ...COMMON_CMS_ICONS]
    : COMMON_CMS_ICONS;

  const filteredIcons = allIcons.filter(
    (i) =>
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative space-y-1" ref={dropdownRef}>
      {label && <label className="block text-[12.5px] font-medium text-[#1A1A1A]">{label}</label>}

      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-md border border-[#E6E6E6] bg-white px-3 text-[13px] text-[#1A1A1A] hover:border-gray-300 focus:border-[#E31E24] focus:outline-none transition-colors"
      >
        <div className="flex items-center gap-2 truncate">
          {isNone ? (
            <>
              <span className="text-gray-400">
                <LucideIcons.Ban size={15} />
              </span>
              <span className="truncate text-gray-600 font-medium">None (No Icon)</span>
            </>
          ) : (
            <>
              <span className="text-[#E31E24]">{renderCmsIcon(selectedIcon, 15)}</span>
              <span className="truncate">{selectedIcon}</span>
            </>
          )}
        </div>
        <ChevronDown size={14} className={cn("text-gray-400 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-60 w-72 rounded-lg border border-[#E6E6E6] bg-white p-2 shadow-lg">
          <div className="relative mb-2">
            <Search size={13} className="absolute left-2.5 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search icon or choose None..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded border border-gray-200 py-1 pl-7 pr-7 text-[12.5px] outline-none focus:border-[#E31E24]"
              autoFocus
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="max-h-44 overflow-y-auto space-y-0.5 pr-1">
            {filteredIcons.map((item) => {
              const isSelected = selectedIcon === item.name || (item.name === "none" && isNone);
              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => {
                    onChange(item.name);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded px-2 py-1.5 text-left text-[12.5px] transition-colors",
                    isSelected
                      ? "bg-red-50 text-[#E31E24] font-medium"
                      : "text-gray-700 hover:bg-gray-100"
                  )}
                >
                  <span className={cn(isSelected ? "text-[#E31E24]" : "text-gray-500")}>
                    {item.name === "none" ? <LucideIcons.Ban size={15} /> : renderCmsIcon(item.name, 15)}
                  </span>
                  <div className="min-w-0 flex-1 truncate">
                    <div className="truncate">{item.name === "none" ? "None (No Icon)" : item.name}</div>
                    <div className="text-[10.5px] text-gray-400 truncate">{item.label}</div>
                  </div>
                </button>
              );
            })}
            {filteredIcons.length === 0 && (
              <div className="p-3 text-center text-xs text-gray-400">No matching icons found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
