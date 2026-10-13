import "server-only";

import { mockShippingProvider } from "@/lib/shipping/mock";
import type { ShippingProvider } from "@/lib/shipping/types";

const providers: Record<string, ShippingProvider> = {
  mock: mockShippingProvider,
  // skydropx / envia adapters plug in here once an aggregator is chosen.
};

export function getShippingProvider(id: string = process.env.SHIPPING_PROVIDER ?? "mock"): ShippingProvider {
  const provider = providers[id];
  if (!provider) throw new Error(`Unknown shipping provider: ${id}`);
  return provider;
}
