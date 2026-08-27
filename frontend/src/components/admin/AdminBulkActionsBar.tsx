"use client";

import React from "react";
import { X } from "lucide-react";

interface AdminBulkActionsBarProps {
  selectedCount: number;
  onClear: () => void;
  actionType: string;
  onActionTypeChange: (val: string) => void;
  actions: { value: string; label: string }[];
  onApply: () => void;
  applyLoading?: boolean;
  applyDisabled?: boolean;
  renderExtraSelectors?: () => React.ReactNode;
  standalone?: boolean;
}

export function AdminBulkActionsBar({
  selectedCount,
  onClear,
  actionType,
  onActionTypeChange,
  actions,
  onApply,
  applyLoading = false,
  applyDisabled = false,
  renderExtraSelectors,
  standalone = false,
}: AdminBulkActionsBarProps) {
  const innerContent = (
    <div className="flex items-center gap-2.5 whitespace-nowrap">
      <span className="inline-flex items-center justify-center h-8 px-2.5 rounded-md bg-[#E31E24]/10 text-[#E31E24] text-[12px] font-semibold">
        {selectedCount} Selected
      </span>
      {selectedCount > 0 && (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center justify-center gap-1 h-8 rounded-md border border-[#E6E6E6] bg-white px-2.5 text-[12px] font-medium text-[#4B5563] hover:bg-gray-50 hover:text-gray-900 transition-all shadow-xs cursor-pointer"
        >
          <X size={13} /> Clear
        </button>
      )}
      {selectedCount > 0 && <div className="h-4 w-px bg-[#E6E6E6]" />}
      
      <select
        value={actionType}
        onChange={(e) => onActionTypeChange(e.target.value)}
        className="h-8 rounded-md border border-[#D1D5DB] bg-white px-3 text-[12.5px] text-[#1F2937] outline-none focus:border-[#E31E24] focus:ring-1 focus:ring-[#E31E24] transition-all shadow-xs cursor-pointer"
      >
        <option value="">Choose Bulk Action</option>
        {actions.map((act) => (
          <option key={act.value} value={act.value}>
            {act.label}
          </option>
        ))}
      </select>

      {renderExtraSelectors && renderExtraSelectors()}

      <button
        type="button"
        onClick={onApply}
        disabled={applyDisabled || applyLoading || !actionType || selectedCount === 0}
        className="h-8 rounded-md bg-[#E31E24] hover:bg-[#B5151B] px-4 text-[12.5px] font-semibold text-white disabled:opacity-40 disabled:hover:bg-[#E31E24] disabled:cursor-not-allowed transition-all shadow-xs flex items-center justify-center min-w-[80px] cursor-pointer"
      >
        {applyLoading ? "Applying..." : "Apply"}
      </button>
    </div>
  );

  if (standalone) {
    return (
      <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg p-3 my-3 shadow-xs">
        {innerContent}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5">
      {innerContent}
    </div>
  );
}
