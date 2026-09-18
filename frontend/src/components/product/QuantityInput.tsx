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
  const clamp = (v: number) => Math.max(min, max !== undefined ? Math.min(max, v) : v);
  const normalize = (v: number) => {
    if (v <= 0) return 0;
    return clamp(Math.max(minPositive, v));
  };

  return (
    <div
      className={`inline-flex min-w-0 items-center rounded-full border border-[#E6E6E6] ${
        disabled ? "pointer-events-none opacity-40" : "bg-white"
      } ${
        size === "xs"
          ? "h-6.5 w-full max-w-[95px] sm:w-[72px] sm:max-w-none"
          : size === "sm" 
          ? "h-8 w-full max-w-[120px] sm:w-[86px] sm:max-w-none" 
          : "h-10 w-full max-w-[180px] sm:h-9 sm:w-[112px] sm:max-w-none"
      }`}
    >
      <button
        type="button"
        onClick={() => onChange(value <= minPositive ? 0 : normalize(value - 1))}
        className={`flex h-full select-none items-center justify-center rounded-l-full text-[#1A1A1A] transition-colors hover:bg-[#F5F5F5] ${
          size === "xs" ? "w-6.5 text-[14px]" : size === "sm" ? "w-8 text-[15px]" : "w-10 text-[18px] sm:w-9"
        }`}
        aria-label="Decrease quantity"
      >
        −
      </button>
      <input
        type="number"
        value={value || ""}
        placeholder="0"
        min={min}
        max={max}
        onChange={(e) => {
          const v = parseInt(e.target.value, 10);
          onChange(isNaN(v) ? 0 : normalize(v));
        }}
        disabled={disabled}
        className={`h-full min-w-0 flex-1 appearance-none border-none bg-transparent p-0 text-center font-semibold text-[#1A1A1A] focus:outline-none focus:ring-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
          size === "xs" ? "text-[11.5px]" : size === "sm" ? "text-[12px]" : "text-[14px]"
        }`}
      />
      <button
        type="button"
        onClick={() => onChange(normalize(value + 1))}
        className={`flex h-full select-none items-center justify-center rounded-r-full text-[#1A1A1A] transition-colors hover:bg-[#F5F5F5] ${
          size === "xs" ? "w-6.5 text-[14px]" : size === "sm" ? "w-8 text-[15px]" : "w-10 text-[18px] sm:w-9"
        }`}
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}
