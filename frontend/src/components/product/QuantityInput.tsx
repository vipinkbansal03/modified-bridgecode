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
      className={`inline-flex min-w-0 items-center rounded-full border border-[#D1D5DB] ${
        disabled ? "pointer-events-none opacity-40" : "bg-white shadow-2xs"
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
        onClick={() => onChange(value <= minPositive ? 0 : normalize(value - 1))}
        className={`flex h-full select-none items-center justify-center rounded-l-full font-bold text-[#111827] transition-colors hover:bg-gray-100 active:bg-gray-200 ${
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
          const raw = e.target.value.replace(/\D/g, "");
          const v = parseInt(raw, 10);
          onChange(isNaN(v) ? 0 : normalize(v));
        }}
        disabled={disabled}
        className={`h-full min-w-0 flex-1 appearance-none border-none bg-transparent p-0 text-center font-bold text-[#111827] focus:outline-none focus:ring-0 ${
          size === "xs" ? "text-[13px]" : size === "sm" ? "text-[13.5px]" : "text-[15px]"
        }`}
      />
      <button
        type="button"
        onClick={() => onChange(normalize(value + 1))}
        className={`flex h-full select-none items-center justify-center rounded-r-full font-bold text-[#111827] transition-colors hover:bg-gray-100 active:bg-gray-200 ${
          size === "xs" ? "w-7 text-[16px]" : size === "sm" ? "w-8 text-[17px]" : "w-10 text-[18px] sm:w-9"
        }`}
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}
