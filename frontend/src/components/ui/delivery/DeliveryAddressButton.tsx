"use client";

import { useState } from "react";
import { ChevronDown, MapPin } from "lucide-react";

import { DeliveryAddressModal } from "./DeliveryAddressModal";

export function DeliveryAddressButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-grey"
      >
        <MapPin
          size={20}
          className="flex-shrink-0 text-[#E31E24]"
          strokeWidth={2}
        />

        <div className="flex flex-col items-start leading-tight">
          <span className="text-[16px] text-steel">
            Delivering To
          </span>

          <span className="flex items-center gap-1 text-[13px] font-semibold text-ink">
            Select Address
            <ChevronDown size={11} />
          </span>
        </div>
      </button>

      <DeliveryAddressModal
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}