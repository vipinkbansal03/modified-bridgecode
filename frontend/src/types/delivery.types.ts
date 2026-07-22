import type { ApiCountry } from "./api.types";

export interface CustomerAddress {
  id: string;
  customerId: string;

  label: string;

  fullName: string;
  phone: string;

  addressLine1: string;
  addressLine2: string | null;

  city: string;
  state: string;
  postalCode: string;

  countryId: string;
  country: ApiCountry;

  isDefault: boolean;

  createdAt: string;
  updatedAt: string;
}

export interface BrowserCoordinates {
  latitude: number;
  longitude: number;
}