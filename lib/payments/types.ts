export type PaymentCheckout = {
  providerPaymentId: string | null;
  // Absolute URL, or a path for in-app checkouts.
  checkoutUrl: string;
};

export type PaymentEvent = {
  providerPaymentId: string;
  status: "approved" | "rejected";
  amountCents: number;
};

// Implemented per payment processor (Mercado Pago, Stripe, ...). Amounts are integer centavos MXN.
export interface PaymentProvider {
  readonly id: string;
  createCheckout(input: { paymentId: string; orderId: string; amountCents: number; description: string }): Promise<PaymentCheckout>;
  // Optional: refunds an approved payment in full.
  refund?(providerPaymentId: string): Promise<void>;
  // Throws WebhookSignatureError on a bad signature; returns null for events we ignore.
  parseWebhook(rawBody: string, headers: Headers): PaymentEvent | null;
}
