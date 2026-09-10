"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/Input";

import { cn } from "@/utils/cn";

interface PincodeSearchProps {
  initialValue?: string;
  loading?: boolean;
  onSearch: (pincode: string) => void;
  error?: string | null;
  onClearError?: () => void;
}

export function PincodeSearch({
  initialValue = "",
  loading = false,
  onSearch,
  error = null,
  onClearError,
}: PincodeSearchProps) {
  const [pincode, setPincode] = useState(initialValue);
  const [localError, setLocalError] = useState<string | null>(null);

  const displayError = error || localError;

  const handleSearch = () => {
    const value = pincode.trim();

    if (!value) {
      setLocalError("Please enter a PIN code.");
      return;
    }

    if (!/^[1-9][0-9]{5}$/.test(value)) {
      setLocalError("Invalid PIN code. Please enter a valid 6-digit PIN code.");
      return;
    }

    setLocalError(null);
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

      <div className="mt-4 flex items-start gap-3">
        <div className="flex-1">
          <Input
            value={pincode}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, "").slice(0, 6);
              setPincode(val);
              if (localError) setLocalError(null);
              if (onClearError) onClearError();
            }}
            placeholder="Enter PIN Code"
            type="text"
            inputMode="numeric"
            error={displayError ?? undefined}
            touched={Boolean(displayError)}
            className={cn(
              "rounded-lg px-4 py-3 text-[14px] outline-none transition-colors",
              displayError
                ? "border-[#E31E24] focus:border-[#E31E24] focus:ring-4 focus:ring-[#E31E24]/10"
                : "border-[#D9D9D9] focus:border-brand/40 focus:ring-4 focus:ring-brand/5"
            )}
            maxLength={6}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSearch();
              }
            }}
          />
        </div>

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