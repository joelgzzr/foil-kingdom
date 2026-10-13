import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

export class WebhookSignatureError extends Error {}

// HMAC-SHA256 over the raw body, hex encoded; constant-time comparison.
export function verifyHmacSignature(rawBody: string, signature: string | null, secret: string | undefined) {
  if (!secret || !signature) throw new WebhookSignatureError("Missing signature or secret");
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  const received = Buffer.from(signature, "hex");
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new WebhookSignatureError("Invalid signature");
  }
}

export function signHmac(rawBody: string, secret: string) {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

// Mock providers move no real money or parcels, so they must never run in production.
export function assertMockAllowed(kind: string) {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_MOCK_PROVIDERS !== "true") {
    throw new Error(`The mock ${kind} provider is disabled in production`);
  }
}
