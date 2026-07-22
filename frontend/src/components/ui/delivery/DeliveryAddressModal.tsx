"use client";

import { useState } from "react";

import { Modal } from "@/components/ui/Modal";
import { useCustomerAddresses } from "@/hooks/api/useCustomerAddresses";
import type { CustomerAddress } from "@/types/delivery.types";

import { CurrentLocationCard } from "./CurrentLocationCard";
import { PincodeSearch } from "./PincodeSearch";
import { SavedAddresses } from "./SavedAddresses";
import { EmptyAddresses } from "./EmptyAddresses";

interface DeliveryAddressModalProps {
  open: boolean;
  onClose: () => void;
}

export function DeliveryAddressModal({
  open,
  onClose,
}: DeliveryAddressModalProps) {
  const {
    data: addresses = [],
    isLoading,
  } = useCustomerAddresses();

  const [selectedAddressId, setSelectedAddressId] = useState<string>();

  const handleAddressSelect = (address: CustomerAddress) => {
    setSelectedAddressId(address.id);

    // We'll persist the selected delivery address later.
    onClose();
  };

  const handleCurrentLocation = () => {
    // Browser geolocation will be implemented next.
  };

  const handlePincodeSearch = (pincode: string) => {
    // PIN search will be implemented next.
    console.log("PIN Code:", pincode);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Choose Delivery Location"
      panelClassName="max-w-xl"
    >
      <div className="space-y-5">
        <CurrentLocationCard
          onClick={handleCurrentLocation}
        />

        <PincodeSearch
          onSearch={handlePincodeSearch}
        />

        {isLoading ? (
          <div className="rounded-lg border border-line p-6 text-center text-sm text-steel">
            Loading saved addresses...
          </div>
        ) : addresses.length > 0 ? (
          <SavedAddresses
            addresses={addresses}
            selectedAddressId={selectedAddressId}
            onSelect={handleAddressSelect}
          />
        ) : (
          <EmptyAddresses />
        )}
      </div>
    </Modal>
  );
}