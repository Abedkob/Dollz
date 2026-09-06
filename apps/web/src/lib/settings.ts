export interface WorkspaceSettings {
  atelierName: string;
  publicEmail: string | null;
  publicPhone: string | null;
  whatsappNumber: string | null;
  locationLabel: string;
  storefrontDescription: string;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  pickupLabel: string;
  pickupAddress: string | null;
  pickupCity: string;
  pickupCountry: string;
  supportedCountryCodes: string[];
  defaultCountry: string;
  checkoutNotice: string;
  defaultCurrency: string;
  defaultProductionMinDays: number;
  defaultProductionMaxDays: number;
  version: number;
  updatedAt: string;
}

export interface SystemStatus {
  environment: string;
  checks: Array<{
    key: string;
    label: string;
    ready: boolean;
    detail: string;
  }>;
}

export interface PublicStoreSettings {
  atelierName: string;
  publicEmail: string | null;
  publicPhone: string | null;
  whatsappNumber: string | null;
  locationLabel: string;
  storefrontDescription: string;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  pickupLabel: string;
  pickupAddress: string | null;
  pickupCity: string;
  pickupCountry: string;
  supportedCountryCodes: string[];
  defaultCountry: string;
  checkoutNotice: string;
}
