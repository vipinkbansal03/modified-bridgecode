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
    <div className="rounded-xl border border-[#E6E6E6] bg-white p-5 shadow-sm">
      <h4 className="text-[15px] font-bold text-ink">
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
          className="flex-1 rounded-lg border border-[#D9D9D9] px-4 py-3 text-[14px] outline-none transition-colors focus:border-brand/40 focus:ring-4 focus:ring-brand/5"
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
          className="flex h-[46px] w-[54px] shrink-0 items-center justify-center rounded-lg bg-brand text-white transition-all duration-300 hover:bg-[#B5151B] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <Search size={18} />
          )}
        </button>
      </div>
    </div>
  );
}