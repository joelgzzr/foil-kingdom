import "server-only";

import type { VisionProvider } from "./types.ts";
import { visionProviders } from "./vision.ts";

function assertMockAllowed(id: string) {
  if (id === "mock" && process.env.NODE_ENV === "production" && process.env.ALLOW_MOCK_PROVIDERS !== "true") {
    throw new Error("The mock scan providers are not allowed in production");
  }
}

export function getVisionProvider(id: string = process.env.SCAN_VISION_PROVIDER ?? "mock"): VisionProvider {
  const provider = visionProviders[id];
  if (!provider) throw new Error(`Unknown scan vision provider: ${id}`);
  assertMockAllowed(id);
  return provider;
}

// Photos a seller may scan per day (each one is a paid vision call).
export const dailyScanPageLimit = () => Number(process.env.SCAN_DAILY_PAGE_LIMIT ?? 10);

// Reference-price conversion for price suggestions; set from a trusted source, refreshed by hand.
export const usdMxnRate = () => {
  const rate = Number(process.env.USD_MXN_RATE ?? 18);
  return Number.isFinite(rate) && rate > 0 ? rate : 18;
};
