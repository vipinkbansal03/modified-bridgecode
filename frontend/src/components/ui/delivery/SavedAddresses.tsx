"use client";

import { Check, Home, Building2 } from "lucide-react";
import type { CustomerAddress } from "@/types/delivery.types";
import { cn } from "@/utils/cn";

interface SavedAddressesProps {
  addresses: CustomerAddress[];
  selectedAddressId?: string;
  onSelect: (address: CustomerAddress) => void;
}

export function SavedAddresses({
  addresses,
  selectedAddressId,
  onSelect,
}: SavedAddressesProps) {
  if (addresses.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3 pt-2">
      <div>
        <h4 className="text-[15px] font-bold text-ink">
          Saved Addresses
        </h4>
        <p className="mt-1 text-[13px] text-steel">
          Select a default or alternate address to check shipping speed.
        </p>
      </div>

      <div className="space-y-3">
        {addresses.map((address) => {
          const selected = selectedAddressId === address.id;

          return (
            <button
              key={address.id}
              type="button"
              onClick={() => onSelect(address)}
              className={cn(
                "group flex w-full items-start justify-between rounded-xl border p-4.5 text-left transition-all duration-300 active:scale-[0.99]",
                selected
                  ? "border-brand bg-brand/5 shadow-md shadow-brand/5"
                  : "border-[#E6E6E6] bg-white shadow-sm hover:border-brand/40 hover:shadow-md hover:shadow-red-500/5"
              )}
            >
              <div className="flex gap-4">
                <div className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-4 transition-colors",
                  selected
                    ? "bg-brand/10 text-brand ring-brand/10"
                    : "bg-[#FAFAFA] text-[#6B6B6B] ring-[#FAFAFA] group-hover:bg-brand/5 group-hover:text-brand group-hover:ring-brand/5"
                )}>
                  {address.label.toLowerCase() === "home" ? (
                    <Home size={18} />
                  ) : (
                    <Building2 size={18} />
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-ink text-[14px]">
                      {address.label}
                    </span>

                    {address.isDefault && (
                      <span className="rounded bg-brand/10 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-brand">
                        Default
                      </span>
                    )}
                  </div>

                  <p className="mt-1.5 text-[13px] leading-5 text-[#6B6B6B]">
                    {address.addressLine1}
                    {address.addressLine2 ? `, ${address.addressLine2}` : ""}
                  </p>

                  <p className="text-[13px] leading-5 text-[#6B6B6B]">
                    {address.city}, {address.state} {address.postalCode}
                  </p>

                  <p className="text-[13px] leading-5 text-steel font-medium mt-0.5">
                    {address.country.name}
                  </p>
                </div>
              </div>

              {selected && (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-white ring-4 ring-brand/10 mt-1">
                  <Check size={14} strokeWidth={3} />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}