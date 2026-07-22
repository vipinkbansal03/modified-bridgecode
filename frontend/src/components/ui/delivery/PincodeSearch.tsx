"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/Input";

interface PincodeSearchProps {
  initialValue?: string;
  loading?: boolean;
  onSearch: (pincode: string) => void;
}

export function PincodeSearch({
  initialValue = "",
  loading = false,
  onSearch,
}: PincodeSearchProps) {
  const [pincode, setPincode] = useState(initialValue);

  const handleSearch = () => {
    const value = pincode.trim();

    if (!value) return;

    onSearch(value);
  };

  return (
    <div className="rounded-lg border border-line p-4">
      <h4 className="text-[15px] font-semibold text-ink">
        Check Delivery by PIN Code
      </h4>

      <p className="mt-1 text-[13px] text-steel">
        Enter your postal code to check delivery availability.
      </p>

      <div className="mt-4 flex gap-3">
        <Input
          value={pincode}
          onChange={(e) => setPincode(e.target.value)}
          placeholder="Enter PIN Code"
          className="flex-1"
          maxLength={10}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleSearch();
            }
          }}
        />

        <button
          type="button"
          onClick={handleSearch}
          disabled={loading}
          className="flex h-[50px] items-center justify-center rounded-md bg-brand px-5 text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Search size={18} />
        </button>
      </div>
    </div>
  );
}