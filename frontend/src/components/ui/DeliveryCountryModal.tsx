"use client";

import { Check } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { useCountries } from "@/hooks/api/useCurrencies";
import { useCurrencyContext } from "@/contexts/CurrencyContext";

interface DeliveryCountryModalProps  {
  open: boolean;
  onClose: () => void;
}

export function DeliveryCountryModal({
  open,
  onClose,
}: DeliveryCountryModalProps ) {
  const { data: countries = [] } = useCountries();

  const {
    selectedCountryCode,
    setSelectedCountryCode,
  } = useCurrencyContext();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Select Delivery Country"
      panelClassName="max-w-md"
    >
      <div className="max-h-[420px] overflow-y-auto">
        {countries.map((country) => {
          const active = selectedCountryCode === country.code;

          return (
            <button
              key={country.id}
              type="button"
              onClick={() => {
                setSelectedCountryCode(country.code);
                onClose();
              }}
              className="flex w-full items-center justify-between rounded-md px-4 py-3 transition-colors hover:bg-grey"
            >
              <span className="text-[15px] text-ink">
                {country.name}
              </span>

              {active && (
                <Check
                  size={18}
                  className="text-brand"
                />
              )}
            </button>
          );
        })}
      </div>
    </Modal>
  );
}