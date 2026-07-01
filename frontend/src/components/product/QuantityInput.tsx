"use client";

interface Props {
  value: number;
  onChange: (val: number) => void;
  min?: number;
  max?: number;
  minPositive?: number;
  disabled?: boolean;
}

export function QuantityInput({ value, onChange, min = 0, max, minPositive = 1, disabled = false }: Props) {
  const clamp = (v: number) => Math.max(min, max !== undefined ? Math.min(max, v) : v);
  const normalize = (v: number) => {
    if (v <= 0) return 0;
    return clamp(Math.max(minPositive, v));
  };
  return (
    <div
      className={`flex h-8 w-[104px] items-center rounded border border-[#E6E6E6] ${
        disabled ? "pointer-events-none opacity-40" : "bg-white"
      }`}
    >
      <button
        type="button"
        onClick={() => onChange(value <= minPositive ? 0 : normalize(value - 1))}
        className="flex h-full w-8 select-none items-center justify-center rounded-l text-[18px] leading-none text-[#6B6B6B] hover:bg-[#F5F5F5]"
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
        className="h-full w-0 flex-1 bg-transparent text-center text-[13px] font-medium text-ink focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button
        type="button"
        onClick={() => onChange(normalize(value <= 0 ? minPositive : value + 1))}
        className="flex h-full w-8 select-none items-center justify-center rounded-r text-[18px] leading-none text-[#6B6B6B] hover:bg-[#F5F5F5]"
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}
