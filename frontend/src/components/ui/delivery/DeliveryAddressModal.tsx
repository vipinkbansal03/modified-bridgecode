"use client";

import { useState, useEffect } from "react";

import { Modal } from "@/components/ui/Modal";
import { useCustomerAddresses } from "@/hooks/api/useCustomerAddresses";
import type { CustomerAddress } from "@/types/delivery.types";

import { CurrentLocationCard } from "./CurrentLocationCard";
import { PincodeSearch } from "./PincodeSearch";
import { SavedAddresses } from "./SavedAddresses";
import { EmptyAddresses } from "./EmptyAddresses";
import { useDeliveryAddress } from "@/contexts/DeliveryAddressContext";

interface DeliveryAddressModalProps {
  open: boolean;
  onClose: () => void;
}

export function DeliveryAddressModal({
  open,
  onClose,
}: DeliveryAddressModalProps) {
  const { data: addresses = [], isLoading } = useCustomerAddresses();

  console.log("Addresses:", addresses);
console.log("Loading:", isLoading);

  const { selectedAddress, setSelectedAddress } = useDeliveryAddress();

  const [selectedAddressId, setSelectedAddressId] = useState<
    string | undefined
  >(selectedAddress?.id);

  useEffect(() => {
    setSelectedAddressId(selectedAddress?.id);
  }, [selectedAddress]);

  const handleAddressSelect = (address: CustomerAddress) => {
    setSelectedAddressId(address.id);
    setSelectedAddress(address);

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
        <CurrentLocationCard onClick={handleCurrentLocation} />

        <PincodeSearch onSearch={handlePincodeSearch} />

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
