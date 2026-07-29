"use client";

import {
  createContext,
  useContext,
  useEffect,
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

  useEffect(() => {
    try {
      const savedAddress = localStorage.getItem("delivery_address");
      const savedCountry = localStorage.getItem("delivery_country");
      const savedPincode = localStorage.getItem("delivery_pincode");
      const savedCoordinates = localStorage.getItem("delivery_coordinates");

      if (savedAddress) setSelectedAddress(JSON.parse(savedAddress));
      if (savedCountry) setSelectedCountry(savedCountry);
      if (savedPincode) setSelectedPincode(savedPincode);
      if (savedCoordinates) setSelectedCoordinates(JSON.parse(savedCoordinates));
    } catch (e) {
      console.error("Error loading delivery address from localStorage:", e);
    }
  }, []);

  const handleSetSelectedAddress = (address: CustomerAddress | null) => {
    setSelectedAddress(address);
    if (address) {
      localStorage.setItem("delivery_address", JSON.stringify(address));
    } else {
      localStorage.removeItem("delivery_address");
    }
  };

  const handleSetSelectedCountry = (country: string | null) => {
    setSelectedCountry(country);
    if (country) {
      localStorage.setItem("delivery_country", country);
    } else {
      localStorage.removeItem("delivery_country");
    }
  };

  const handleSetSelectedPincode = (pincode: string | null) => {
    setSelectedPincode(pincode);
    if (pincode) {
      localStorage.setItem("delivery_pincode", pincode);
    } else {
      localStorage.removeItem("delivery_pincode");
    }
  };

  const handleSetSelectedCoordinates = (coordinates: BrowserCoordinates | null) => {
    setSelectedCoordinates(coordinates);
    if (coordinates) {
      localStorage.setItem("delivery_coordinates", JSON.stringify(coordinates));
    } else {
      localStorage.removeItem("delivery_coordinates");
    }
  };

  const clearSelection = () => {
    setSelectedAddress(null);
    setSelectedCountry(null);
    setSelectedPincode(null);
    setSelectedCoordinates(null);
    localStorage.removeItem("delivery_address");
    localStorage.removeItem("delivery_country");
    localStorage.removeItem("delivery_pincode");
    localStorage.removeItem("delivery_coordinates");
  };

  const value = useMemo(
    () => ({
      selectedAddress,
      selectedCountry,
      selectedPincode,
      selectedCoordinates,

      setSelectedAddress: handleSetSelectedAddress,
      setSelectedCountry: handleSetSelectedCountry,
      setSelectedPincode: handleSetSelectedPincode,
      setSelectedCoordinates: handleSetSelectedCoordinates,

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