import "server-only";

import { z } from "zod";

import { assertMockAllowed, verifyHmacSignature } from "@/lib/webhook-signature";
import type { PaymentProvider } from "@/lib/payments/types";

const webhookSchema = z.object({
  provider_payment_id: z.string().min(1),
  status: z.enum(["approved", "rejected"]),
  amount_cents: z.number().int().positive(),
});

// In-app fake checkout for local development and tests.
export const mockPaymentProvider: PaymentProvider = {
  id: "mock",

  async createCheckout({ paymentId }) {
    assertMockAllowed("payment");
    return { providerPaymentId: `mock_${paymentId}`, checkoutUrl: `/pay/mock/${paymentId}` };
  },

  async refund() {
    assertMockAllowed("payment");
  },

  parseWebhook(rawBody, headers) {
    assertMockAllowed("payment");
    verifyHmacSignature(rawBody, headers.get("x-signature"), process.env.PAYMENT_WEBHOOK_SECRET);
    const parsed = webhookSchema.safeParse(JSON.parse(rawBody));
    if (!parsed.success) return null;
    return {
      providerPaymentId: parsed.data.provider_payment_id,
      status: parsed.data.status,
      amountCents: parsed.data.amount_cents,
    };
  },
};
