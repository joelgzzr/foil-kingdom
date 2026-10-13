import "server-only";

import { z } from "zod";

import { assertMockAllowed, verifyHmacSignature } from "@/lib/webhook-signature";
import type { ShippingProvider } from "@/lib/shipping/types";

const webhookSchema = z.object({
  tracking_number: z.string().min(1),
  status: z.enum(["in_transit", "delivered", "exception"]),
  description: z.string().nullish(),
  occurred_at: z.iso.datetime(),
});

// Deterministic fake carrier for local development and tests.
export const mockShippingProvider: ShippingProvider = {
  id: "mock",

  async getRates({ origin, destination, parcel }) {
    assertMockAllowed("shipping");
    const steps = Math.max(1, Math.ceil(parcel.weightGrams / 500));
    const zoneSurcharge = origin.state === destination.state ? 0 : 3000;
    const economy = 8900 + (steps - 1) * 2500 + zoneSurcharge;
    return [
      { providerRateId: `mock:economy:${economy}`, carrier: "Mock Paq", service: "Económico", priceCents: economy, estimatedDays: 5 },
      { providerRateId: `mock:express:${economy * 2}`, carrier: "Mock Paq", service: "Express", priceCents: economy * 2, estimatedDays: 2 },
    ];
  },

  async createLabel({ providerRateId }) {
    assertMockAllowed("shipping");
    const [, service] = providerRateId.split(":");
    const trackingNumber = `MOCK${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    return {
      providerShipmentId: `mock-${trackingNumber}`,
      carrier: "Mock Paq",
      service: service === "express" ? "Express" : "Económico",
      trackingNumber,
      labelUrl: null,
    };
  },

  parseWebhook(rawBody, headers) {
    assertMockAllowed("shipping");
    verifyHmacSignature(rawBody, headers.get("x-signature"), process.env.SHIPPING_WEBHOOK_SECRET);
    const parsed = webhookSchema.safeParse(JSON.parse(rawBody));
    if (!parsed.success) return null;
    return {
      trackingNumber: parsed.data.tracking_number,
      status: parsed.data.status,
      description: parsed.data.description ?? null,
      occurredAt: parsed.data.occurred_at,
    };
  },
};
