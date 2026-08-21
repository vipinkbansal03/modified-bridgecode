"use client";

import "react-phone-number-input/style.css";
import "./PhoneInput.css";

import PhoneInput from "react-phone-number-input";
import { Smartphone } from "lucide-react";

interface PhoneInputFieldProps {
  value?: string;
  onChange: (value?: string) => void;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  error?: string;
  touched?: boolean;
  defaultCountry?: "IN" | "US" | "GB" | "AU" | "DE";
  placeholder?: string;
  disabled?: boolean;
  countryKey?: string;
  className?: string;
}

export default function PhoneInputField({
  value,
  onChange,
  onBlur,
  error,
  touched,
  defaultCountry = "IN",
  placeholder = "Mobile",
  disabled,
  countryKey,
  className = "",
}: PhoneInputFieldProps) {
  const showError = Boolean((touched || Boolean(value && value.length > 0)) && error);

  return (
    <div>
      <div
        className={`flex h-10 sm:h-9 overflow-hidden rounded-md border bg-[#EEF4FF] transition-colors ${
          showError
            ? "border-[#E31E24]"
            : "border-[#E0E0E0] focus-within:border-[#E31E24]"
        } ${className}`}
      >
        <span className="flex w-10 shrink-0 items-center justify-center border-r border-[#E0E0E0] bg-white/65 text-[#6B6B6B]">
          <Smartphone size={14} />
        </span>

        <PhoneInput
          key={countryKey}
          international
          withCountryCallingCode
          defaultCountry={defaultCountry}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          disabled={disabled}
          placeholder={placeholder}
          className="flex flex-1 items-center"
          numberInputProps={{
            className:
              "h-full w-full bg-transparent px-2 text-[16px] sm:text-[12.5px] text-[#1A1A1A] outline-none placeholder:text-[#8A8A8A]",
          }}
        />
      </div>

      {showError && (
        <p className="mt-0.5 text-[11px] text-[#E31E24]">{error}</p>
      )}
    </div>
  );
}