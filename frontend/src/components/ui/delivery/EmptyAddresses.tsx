"use client";

import { MapPinned } from "lucide-react";

export function EmptyAddresses() {
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
        You can save addresses after signing in and placing an order.
      </p>
    </div>
  );
}