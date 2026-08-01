export interface ShippingProviderCredentials {
  apiKey: string;
  apiSecret?: string | null;
  baseUrl?: string | null;
  rateEndpoint?: string | null;
  mode?: "sandbox" | "production";
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  latencyMs: number;
}

export interface RateRequest {
  countryCode: string;
  orderTotal: number;
  weight?: number;
  dimensions?: { length: number; width: number; height: number };
  destinationPincode?: string;
}

export interface RateResult {
  provider: string;
  service: string;
  charge: number;
  currency: string;
  estimatedDays: string;
  raw?: unknown;
}

export interface ShipmentRequest {
  orderNumber: string;
  recipientName: string;
  recipientEmail?: string;
  address: Record<string, string>;
  countryCode: string;
  items: { title: string; sku?: string; quantity: number; weight?: number; value: number }[];
  totalValue: number;
  reference?: string;
}

export interface ShipmentResult {
  success: boolean;
  trackingNumber?: string;
  labelUrl?: string;
  estimatedDelivery?: string;
  providerResponse?: unknown;
  error?: string;
}

export interface TrackingUpdate {
  status: string;
  location?: string;
  timestamp: string;
  description?: string;
}

export interface TrackingResult {
  trackingNumber: string;
  status: string;
  updates: TrackingUpdate[];
  raw?: unknown;
}

export interface CancelResult {
  success: boolean;
  message: string;
  raw?: unknown;
}

export interface ShippingProviderAdapter {
  name: string;
  testConnection(credentials: ShippingProviderCredentials): Promise<ConnectionTestResult>;
  getRates(credentials: ShippingProviderCredentials, request: RateRequest): Promise<RateResult[]>;
  createShipment(credentials: ShippingProviderCredentials, request: ShipmentRequest): Promise<ShipmentResult>;
  trackShipment(credentials: ShippingProviderCredentials, trackingNumber: string): Promise<TrackingResult>;
  cancelShipment?(credentials: ShippingProviderCredentials, trackingNumber: string): Promise<CancelResult>;
}
