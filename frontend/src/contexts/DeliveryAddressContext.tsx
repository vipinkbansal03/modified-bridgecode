"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type {
  BrowserCoordinates,
  CustomerAddress,
} from "@/types/delivery.types";

interface DeliveryAddressContextValue {
  selectedAddress: CustomerAddress | null;
  selectedCountry: string | null;
  selectedPincode: string | null;
  selectedCoordinates: BrowserCoordinates | null;

  setSelectedAddress: (address: CustomerAddress | null) => void;
  setSelectedCountry: (country: string | null) => void;
  setSelectedPincode: (pincode: string | null) => void;
  setSelectedCoordinates: (coordinates: BrowserCoordinates | null) => void;

  clearSelection: () => void;
}

const DeliveryAddressContext =
  createContext<DeliveryAddressContextValue | null>(null);

export function DeliveryAddressProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [selectedAddress, setSelectedAddress] =
    useState<CustomerAddress | null>(null);

  const [selectedCountry, setSelectedCountry] =
    useState<string | null>(null);

  const [selectedPincode, setSelectedPincode] =
    useState<string | null>(null);

  const [selectedCoordinates, setSelectedCoordinates] =
    useState<BrowserCoordinates | null>(null);

  const clearSelection = () => {
    setSelectedAddress(null);
    setSelectedCountry(null);
    setSelectedPincode(null);
    setSelectedCoordinates(null);
  };

  const value = useMemo(
    () => ({
      selectedAddress,
      selectedCountry,
      selectedPincode,
      selectedCoordinates,

      setSelectedAddress,
      setSelectedCountry,
      setSelectedPincode,
      setSelectedCoordinates,

      clearSelection,
    }),
    [
      selectedAddress,
      selectedCountry,
      selectedPincode,
      selectedCoordinates,
    ]
  );

  return (
    <DeliveryAddressContext.Provider value={value}>
      {children}
    </DeliveryAddressContext.Provider>
  );
}

export function useDeliveryAddress() {
  const context = useContext(DeliveryAddressContext);

  if (!context) {
    throw new Error(
      "useDeliveryAddress must be used within DeliveryAddressProvider"
    );
  }

  return context;
}