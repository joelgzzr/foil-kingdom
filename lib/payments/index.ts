import "server-only";

import { mockPaymentProvider } from "@/lib/payments/mock";
import type { PaymentProvider } from "@/lib/payments/types";

const providers: Record<string, PaymentProvider> = {
  mock: mockPaymentProvider,
  // mercadopago adapter plugs in here.
};

export function getPaymentProvider(id: string = process.env.PAYMENT_PROVIDER ?? "mock"): PaymentProvider {
  const provider = providers[id];
  if (!provider) throw new Error(`Unknown payment provider: ${id}`);
  return provider;
}
