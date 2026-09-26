"use client";

interface Props {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  minPositive?: number;
  disabled?: boolean;
  size?: "default" | "sm" | "xs";
}

export function QuantityInput({ value, onChange, min = 0, max, minPositive = 1, disabled = false, size = "default" }: Props) {
  const isInputDisabled = disabled || (max !== undefined && max <= 0);
  const clamp = (v: number) => {
    if (max !== undefined && max <= 0) return 0;
    const upperClamped = max !== undefined ? Math.min(max, v) : v;
    return Math.max(min, upperClamped);
  };
  const normalize = (v: number) => {
    if (isInputDisabled || v <= 0) return 0;
    return clamp(Math.max(minPositive, v));
  };

  const isDecDisabled = isInputDisabled || value <= min;
  const isIncDisabled = isInputDisabled || (max !== undefined && value >= max);

  return (
    <div
      className={`inline-flex min-w-0 items-center rounded-full border border-[#E31E24] ${
        isInputDisabled ? "pointer-events-none opacity-40 bg-gray-50 cursor-not-allowed" : "bg-white shadow-2xs"
      } ${
        size === "xs"
          ? "h-7.5 w-full max-w-[100px] sm:w-[82px] sm:max-w-none"
          : size === "sm" 
          ? "h-8.5 w-full max-w-[120px] sm:w-[90px] sm:max-w-none" 
          : "h-10 w-full max-w-[180px] sm:h-9 sm:w-[112px] sm:max-w-none"
      }`}
    >
      <button
        type="button"
        disabled={isDecDisabled}
        onClick={() => {
          if (isDecDisabled) return;
          onChange(value <= minPositive ? 0 : normalize(value - 1));
        }}
        className={`flex h-full select-none items-center justify-center rounded-l-full font-bold text-[#E31E24] transition-colors hover:bg-red-50 active:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent ${
          size === "xs" ? "w-7 text-[16px]" : size === "sm" ? "w-8 text-[17px]" : "w-10 text-[18px] sm:w-9"
        }`}
        aria-label="Decrease quantity"
      >
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value || ""}
        placeholder="0"
        onChange={(e) => {
          if (isInputDisabled) return;
          const raw = e.target.value.replace(/\D/g, "");
          const v = parseInt(raw, 10);
          onChange(isNaN(v) ? 0 : normalize(v));
        }}
        disabled={isInputDisabled}
        className={`h-full min-w-0 flex-1 appearance-none border-none bg-transparent p-0 text-center font-bold text-[#111827] placeholder:text-[#111827] focus:outline-none focus:ring-0 disabled:cursor-not-allowed ${
          size === "xs" ? "text-[13px]" : size === "sm" ? "text-[13.5px]" : "text-[15px]"
        }`}
      />
      <button
        type="button"
        disabled={isIncDisabled}
        onClick={() => {
          if (isIncDisabled) return;
          onChange(normalize(value + 1));
        }}
        className={`flex h-full select-none items-center justify-center rounded-r-full font-bold text-[#E31E24] transition-colors hover:bg-red-50 active:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent ${
          size === "xs" ? "w-7 text-[16px]" : size === "sm" ? "w-8 text-[17px]" : "w-10 text-[18px] sm:w-9"
        }`}
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}
