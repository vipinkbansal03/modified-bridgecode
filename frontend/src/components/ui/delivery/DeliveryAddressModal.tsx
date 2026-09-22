"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Plus, ChevronRight } from "lucide-react";

import { Modal } from "@/components/ui/Modal";
import { useCustomerAddresses } from "@/hooks/api/useCustomerAddresses";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import type { CustomerAddress } from "@/types/delivery.types";

import { CurrentLocationCard } from "./CurrentLocationCard";
import { PincodeSearch } from "./PincodeSearch";
import { SavedAddresses } from "./SavedAddresses";
import { EmptyAddresses } from "./EmptyAddresses";
import { useDeliveryAddress } from "@/contexts/DeliveryAddressContext";
import { useToast } from "@/components/ui/ToastProvider";

interface DeliveryAddressModalProps {
  open: boolean;
  onClose: () => void;
}

export function DeliveryAddressModal({
  open,
  onClose,
}: DeliveryAddressModalProps) {
  const router = useRouter();
  const { currentCustomer } = useCustomerAuth();
  const { showToast } = useToast();
  const { data: addresses = [], isLoading } = useCustomerAddresses(); 

  const {
    selectedAddress,
    setSelectedAddress,
    setSelectedPincode,
    setSelectedCoordinates,
  } = useDeliveryAddress();

  const displayAddresses = useMemo(() => {
    if (
      selectedAddress &&
      (selectedAddress.id.startsWith("geo-") ||
        selectedAddress.id.startsWith("pin-"))
    ) {
      if (!addresses.some((a) => a.id === selectedAddress.id)) {
        return [selectedAddress, ...addresses];
      }
    }
    return addresses;
  }, [addresses, selectedAddress]);

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

  const [detecting, setDetecting] = useState(false);
  const [searchingPin, setSearchingPin] = useState(false);
  const [pincodeError, setPincodeError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setPincodeError(null);
    }
  }, [open]);

  const handleCurrentLocation = async () => {
    setDetecting(true);

    const applyLocation = (params: {
      city: string;
      state: string;
      pincode: string;
      street?: string;
      country?: string;
      countryCode?: string;
      coords?: { latitude: number; longitude: number };
    }) => {
      const { city, state, pincode, street, country = "India", countryCode = "IN", coords } = params;
      const cleanStreet = street || (city && state ? `${city}, ${state}` : city || state || "Detected Location");
      const mockAddress: CustomerAddress = {
        id: `geo-${Date.now()}`,
        customerId: "",
        label: "Current Location",
        fullName: "",
        phone: "",
        addressLine1: cleanStreet,
        addressLine2: null,
        city: city || "Detected City",
        state: state || "Detected State",
        postalCode: pincode || "",
        countryId: "",
        country: {
          id: "",
          name: country,
          code: countryCode.toUpperCase(),
          currencyId: "",
          symbol: "₹",
        } as any,
        isDefault: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setSelectedAddress(mockAddress);
      if (pincode) setSelectedPincode?.(pincode);
      if (coords) setSelectedCoordinates?.(coords);
      showToast(`Location detected: ${city || state || "Current Location"}`, "success");
      onClose();
    };

    const fallbackToIpLocation = async () => {
      try {
        const res = await fetch("https://ipwho.is/");
        if (res.ok) {
          const data = await res.json();
          if (data && data.success) {
            applyLocation({
              city: data.city || "",
              state: data.region || "",
              pincode: data.postal || "",
              street: `${data.city || ""}, ${data.region || ""}`.replace(/^,\s*|,\s*$/g, ""),
              country: data.country || "India",
              countryCode: data.country_code || "IN",
              coords: data.latitude && data.longitude ? { latitude: data.latitude, longitude: data.longitude } : undefined,
            });
            return true;
          }
        }
      } catch (err) {
        console.warn("ipwho.is failed, trying secondary IP fallback:", err);
      }

      try {
        const res2 = await fetch("https://ipapi.co/json/");
        if (res2.ok) {
          const data2 = await res2.json();
          if (data2 && data2.city) {
            applyLocation({
              city: data2.city || "",
              state: data2.region || "",
              pincode: data2.postal || "",
              street: `${data2.city || ""}, ${data2.region || ""}`.replace(/^,\s*|,\s*$/g, ""),
              country: data2.country_name || "India",
              countryCode: data2.country_code || "IN",
              coords: data2.latitude && data2.longitude ? { latitude: data2.latitude, longitude: data2.longitude } : undefined,
            });
            return true;
          }
        }
      } catch (err2) {
        console.warn("ipapi.co fallback failed:", err2);
      }

      return false;
    };

    // Check if secure context is available.
    // Modern browsers (Chrome, Edge, Firefox) disable navigator.geolocation on HTTP (insecure context),
    // throwing PERMISSION_DENIED immediately without prompting the user.
    const isSecure =
      typeof window !== "undefined" &&
      (window.isSecureContext ||
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1");

    if (!isSecure || !navigator.geolocation) {
      const ok = await fallbackToIpLocation();
      setDetecting(false);
      if (!ok) {
        showToast("Unable to detect location automatically. Please enter your PIN code.", "warning");
      }
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          let resolved = false;

          try {
            const bdcRes = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
            );
            if (bdcRes.ok) {
              const bdcData = await bdcRes.json();
              if (bdcData && (bdcData.city || bdcData.locality || bdcData.principalSubdivision)) {
                const city = bdcData.city || bdcData.locality || "Detected City";
                const state = bdcData.principalSubdivision || "Detected State";
                const pincode = bdcData.postcode || "";
                const country = bdcData.countryName || "India";
                const countryCode = bdcData.countryCode || "IN";
                applyLocation({
                  city,
                  state,
                  pincode,
                  street: `${city}, ${state}`,
                  country,
                  countryCode,
                  coords: { latitude, longitude },
                });
                resolved = true;
              }
            }
          } catch (e) {
            console.warn("BigDataCloud reverse geocoding failed, trying Nominatim:", e);
          }

          if (!resolved) {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
            );
            const data = await res.json();
            const address = data.address || {};
            const city = address.city || address.town || address.village || address.county || "Detected City";
            const state = address.state || "Detected State";
            const pincode = address.postcode || "";

            const displayName = data.display_name || "";
            const parts = displayName.split(",").map((p: string) => p.trim());
            const streetParts = parts.filter((part: string) => {
              const low = part.toLowerCase();
              return (
                low !== city.toLowerCase() &&
                low !== state.toLowerCase() &&
                low !== (address.country || "India").toLowerCase() &&
                low !== pincode.toLowerCase() &&
                low !== "india" &&
                low !== address.country_code?.toLowerCase()
              );
            });
            const cleanStreet = streetParts.join(", ") || `${city}, ${state}`;

            applyLocation({
              city,
              state,
              pincode,
              street: cleanStreet,
              country: address.country || "India",
              countryCode: address.country_code?.toUpperCase() || "IN",
              coords: { latitude, longitude },
            });
          }
        } catch (error) {
          console.error("Reverse geocoding error, falling back to IP:", error);
          const ok = await fallbackToIpLocation();
          if (!ok) {
            showToast("Failed to resolve your location. Please enter your PIN code.", "error");
          }
        } finally {
          setDetecting(false);
        }
      },
      async (error) => {
        console.warn("Browser geolocation failed/denied, falling back to IP:", error);
        const ok = await fallbackToIpLocation();
        setDetecting(false);
        if (!ok) {
          showToast(
            "Unable to retrieve your location. Please check browser permissions or enter your PIN code.",
            "warning"
          );
        }
      },
      {
        enableHighAccuracy: false,
        timeout: 6000,
        maximumAge: 300000,
      }
    );
  };

  const handlePincodeSearch = async (pincode: string) => {
    const pinNormalized = pincode.trim();
    if (!pinNormalized) {
      setPincodeError("Please enter a PIN code.");
      return;
    }

    if (!/^[1-9][0-9]{5}$/.test(pinNormalized)) {
      setPincodeError("Invalid PIN code. Please enter a valid 6-digit PIN code.");
      return;
    }

    setPincodeError(null);
    setSearchingPin(true);

    // 1. Check local test pincodes map first for instant local testing response
    const LOCAL_PINCODES: Record<string, { city: string; state: string; area: string }> = {
      "302034": { city: "Jaipur", state: "Rajasthan", area: "Plot no. 5, Riddhi Nagar, Mansarovar" },
      "302016": { city: "Jaipur", state: "Rajasthan", area: "Sector 10, Mansarovar" },
      "302001": { city: "Jaipur", state: "Rajasthan", area: "M.I. Road, C-Scheme" },
      "110001": { city: "New Delhi", state: "Delhi", area: "Barakhamba Road, Connaught Place" },
      "400001": { city: "Mumbai", state: "Maharashtra", area: "Mahatma Gandhi Road, Fort" },
      "560001": { city: "Bengaluru", state: "Karnataka", area: "Palace Road, Vasanth Nagar" },
      "600001": { city: "Chennai", state: "Tamil Nadu", area: "Rajaji Salai, George Town" },
      "700001": { city: "Kolkata", state: "West Bengal", area: "Netaji Subhas Road, Fairley Place" },
    };

    if (LOCAL_PINCODES[pinNormalized]) {
      const { city, state, area } = LOCAL_PINCODES[pinNormalized];
      const mockAddress: CustomerAddress = {
        id: `pin-${pinNormalized}`,
        customerId: "",
        label: `PIN ${pinNormalized}`,
        fullName: "",
        phone: "",
        addressLine1: area,
        addressLine2: null,
        city,
        state,
        postalCode: pinNormalized,
        countryId: "",
        country: { id: "", name: "India", code: "IN", currencyId: "", symbol: "₹" } as any,
        isDefault: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setSelectedAddress(mockAddress);
      setSelectedPincode?.(pinNormalized);
      setSearchingPin(false);
      onClose();
      return;
    }

    try {
      // 2. Try Indian Post Office API
      const res = await fetch(`https://api.postalpincode.in/pincode/${pinNormalized}`);
      const data = await res.json();
      if (data && data[0] && data[0].Status === "Success" && data[0].PostOffice?.[0]) {
        const po = data[0].PostOffice[0];
        const city = po.District || po.Block || "Detected City";
        const state = po.State || "Detected State";
        const areaName = po.Name ? `${po.Name}, ${city}` : `${city} Region`;
        
        const mockAddress: CustomerAddress = {
          id: `pin-${pinNormalized}`,
          customerId: "",
          label: `PIN ${pinNormalized}`,
          fullName: "",
          phone: "",
          addressLine1: areaName,
          addressLine2: null,
          city,
          state,
          postalCode: pinNormalized,
          countryId: "",
          country: { id: "", name: po.Country || "India", code: "IN", currencyId: "", symbol: "₹" } as any,
          isDefault: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        setSelectedAddress(mockAddress);
        setSelectedPincode?.(pinNormalized);
        setSearchingPin(false);
        onClose();
        return;
      }
    } catch (e) {
      console.warn("Pincode API error, falling back to OSM Nominatim:", e);
    }

    try {
      // 3. Fall back to Nominatim search geocoding
      const res2 = await fetch(
        `https://nominatim.openstreetmap.org/search?postalcode=${pinNormalized}&countrycodes=in&format=json`
      );
      const data2 = await res2.json();
      if (data2 && data2[0]) {
        const parts = data2[0].display_name.split(",").map((s: string) => s.trim());
        const city = parts[0] || "Detected City";
        const state = parts[1] || "Detected State";

        // Parse display_name to extract clean street component
        const displayName = data2[0].display_name || "";
        const nameParts = displayName.split(",").map((s: string) => s.trim());
        const streetParts = nameParts.filter((part: string) => {
          const low = part.toLowerCase();
          return (
            low !== city.toLowerCase() &&
            low !== state.toLowerCase() &&
            low !== "india" &&
            low !== pinNormalized.toLowerCase()
          );
        });
        const cleanStreet = streetParts.join(", ") || "Pincode Search";

        const mockAddress: CustomerAddress = {
          id: `pin-${pinNormalized}`,
          customerId: "",
          label: `PIN ${pinNormalized}`,
          fullName: "",
          phone: "",
          addressLine1: cleanStreet,
          addressLine2: null,
          city,
          state,
          postalCode: pinNormalized,
          countryId: "",
          country: { id: "", name: "India", code: "IN", currencyId: "", symbol: "₹" } as any,
          isDefault: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        setSelectedAddress(mockAddress);
        setSelectedPincode?.(pinNormalized);
        setSearchingPin(false);
        onClose();
        return;
      }
    } catch (e) {
      console.warn("OSM Nominatim search error:", e);
    }

    // 4. If pincode is not found in any source, display error and do not accept
    const errorMessage = "Delivery is not available for this PIN code.";
    setPincodeError(errorMessage);
    showToast(errorMessage, "error");
    setSearchingPin(false);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Choose Delivery Location"
      panelClassName="max-w-xl max-h-[90vh] flex flex-col"
    >
      <div className="space-y-6 p-6 overflow-y-auto flex-1">
        <CurrentLocationCard onClick={handleCurrentLocation} loading={detecting} />

        <PincodeSearch
          onSearch={handlePincodeSearch}
          loading={searchingPin}
          error={pincodeError}
          onClearError={() => setPincodeError(null)}
        />

        {isLoading ? (
          <div className="rounded-lg border border-line p-6 text-center text-sm text-steel">
            Loading saved addresses...
          </div>
        ) : displayAddresses.length > 0 ? (
          <SavedAddresses
            addresses={displayAddresses}
            selectedAddressId={selectedAddressId}
            onSelect={handleAddressSelect}
          />
        ) : (
          <EmptyAddresses />
        )}

        {/* Amazon-style Add an address or pick-up point Action */}
        <div className="pt-2 border-t border-[#E5E7EB]">
          <button
            type="button"
            onClick={() => {
              onClose();
              if (currentCustomer) {
                router.push("/account?tab=addresses");
              } else {
                router.push("/login?returnTo=" + encodeURIComponent("/account?tab=addresses"));
              }
            }}
            className="flex w-full items-center justify-between rounded-xl border border-[#E5E7EB] bg-white p-3.5 text-left transition-all hover:border-[#E31E24]/50 hover:bg-red-50/20 group cursor-pointer shadow-2xs"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-[#E31E24] group-hover:scale-105 transition-transform">
                <Plus size={18} />
              </div>
              <div>
                <span className="text-[13.5px] font-bold text-[#111827] group-hover:text-[#E31E24] transition-colors">
                  Add an address or pick-up point
                </span>
                <p className="text-[11.5px] text-[#6B7280]">
                  Manage your saved shipping addresses and delivery preferences
                </p>
              </div>
            </div>
            <ChevronRight size={16} className="text-[#9CA3AF] group-hover:text-[#E31E24] group-hover:translate-x-0.5 transition-all" />
          </button>
        </div>
      </div>
    </Modal>
  );
}
