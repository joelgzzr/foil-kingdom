export type ShippingAddress = {
  name: string;
  phone: string;
  street: string;
  exteriorNumber: string;
  interiorNumber: string | null;
  neighborhood: string;
  municipality: string;
  state: string;
  postalCode: string;
  reference: string | null;
};

export type ShippingParcel = {
  weightGrams: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
};

export type ShippingRate = {
  providerRateId: string;
  carrier: string;
  service: string;
  priceCents: number;
  estimatedDays: number | null;
};

export type ShippingLabel = {
  providerShipmentId: string;
  carrier: string;
  service: string;
  trackingNumber: string;
  // Null when the provider has no hosted label; the app then renders its own.
  labelUrl: string | null;
};

export type TrackingEvent = {
  trackingNumber: string;
  status: "in_transit" | "delivered" | "exception";
  description: string | null;
  occurredAt: string;
};

export type ShipmentRoute = {
  origin: ShippingAddress;
  destination: ShippingAddress;
  parcel: ShippingParcel;
};

// Implemented per carrier aggregator (Skydropx, Envia, ...). Prices are integer centavos MXN.
export interface ShippingProvider {
  readonly id: string;
  getRates(route: ShipmentRoute): Promise<ShippingRate[]>;
  createLabel(route: ShipmentRoute & { providerRateId: string; reference: string }): Promise<ShippingLabel>;
  // Optional: cancels an unused label so the carrier refunds it.
  voidLabel?(providerShipmentId: string): Promise<void>;
  // Throws WebhookSignatureError on a bad signature; returns null for events we ignore.
  parseWebhook(rawBody: string, headers: Headers): TrackingEvent | null;
}
