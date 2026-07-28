import type { ShippingProviderAdapter } from "./types";
import { dhlAdapter } from "./dhl.adapter";
import { dtdcAdapter } from "./dtdc.adapter";

const adapters: Record<string, ShippingProviderAdapter> = {
  DHL: dhlAdapter,
  DTDC: dtdcAdapter,
};

export function getAdapter(providerName: string): ShippingProviderAdapter | null {
  return adapters[providerName.toUpperCase()] ?? null;
}

export function registerAdapter(name: string, adapter: ShippingProviderAdapter) {
  adapters[name.toUpperCase()] = adapter;
}

export type { ShippingProviderAdapter, ShippingProviderCredentials, ConnectionTestResult, RateRequest, RateResult, ShipmentRequest, ShipmentResult, TrackingResult, TrackingUpdate } from "./types";
