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
    <div className="rounded-lg border border-line">
      <div className="border-b border-line px-4 py-3">
        <h4 className="text-[15px] font-semibold text-ink">
          Saved Addresses
        </h4>
      </div>

      <div className="divide-y divide-line">
        {addresses.map((address) => {
          const selected = selectedAddressId === address.id;

          return (
            <button
              key={address.id}
              type="button"
              onClick={() => onSelect(address)}
              className={cn(
                "flex w-full items-start justify-between px-4 py-4 text-left transition-colors hover:bg-grey",
                selected && "bg-brand/5"
              )}
            >
              <div className="flex gap-3">
                <div className="mt-0.5">
                  {address.label.toLowerCase() === "home" ? (
                    <Home
                      size={18}
                      className="text-brand"
                    />
                  ) : (
                    <Building2
                      size={18}
                      className="text-brand"
                    />
                  )}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-ink">
                      {address.label}
                    </span>

                    {address.isDefault && (
                      <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-medium text-brand">
                        Default
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-[13px] text-steel">
                    {address.addressLine1}
                    {address.addressLine2
                      ? `, ${address.addressLine2}`
                      : ""}
                  </p>

                  <p className="text-[13px] text-steel">
                    {address.city}, {address.state}{" "}
                    {address.postalCode}
                  </p>

                  <p className="text-[13px] text-steel">
                    {address.country.name}
                  </p>
                </div>
              </div>

              {selected && (
                <Check
                  size={18}
                  className="mt-1 text-brand"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}