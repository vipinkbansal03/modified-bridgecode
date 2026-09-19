"use client";

import { MapPinned, Plus } from "lucide-react";

interface EmptyAddressesProps {
  onAddNew?: () => void;
}

export function EmptyAddresses({ onAddNew }: EmptyAddressesProps) {
  return (
    <div className="rounded-lg border border-dashed border-line p-8 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-grey">
        <MapPinned
          size={26}
          className="text-brand"
        />
      </div>

      <h4 className="mt-4 text-[16px] font-semibold text-ink">
        No Saved Addresses
      </h4>

      <p className="mt-2 text-[13px] leading-6 text-steel">
        Use your current location or enter a PIN code to estimate delivery.
        You can save addresses after signing in.
      </p>

      {onAddNew && (
        <button
          type="button"
          onClick={onAddNew}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-[12.5px] font-semibold text-white hover:bg-brand/90 transition-colors shadow-sm cursor-pointer"
        >
          <Plus size={14} />
          <span>Add New Address</span>
        </button>
      )}
    </div>
  );
}