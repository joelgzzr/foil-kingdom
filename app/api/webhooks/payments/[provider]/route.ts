import { NextResponse } from "next/server";

import { applyPaymentEvent } from "@/lib/orders/process";
import { getPaymentProvider } from "@/lib/payments";
import { WebhookSignatureError } from "@/lib/webhook-signature";

export async function POST(request: Request, ctx: RouteContext<"/api/webhooks/payments/[provider]">) {
  const { provider: providerId } = await ctx.params;
  const rawBody = await request.text();

  try {
    const provider = getPaymentProvider(providerId);
    const event = provider.parseWebhook(rawBody, request.headers);
    if (!event) return NextResponse.json({ ok: true, ignored: true });

    const result = await applyPaymentEvent(provider.id, event);
    // 4xx makes the processor retry only when retrying could help.
    return NextResponse.json({ ok: result.handled, reason: result.reason }, { status: result.handled ? 200 : 422 });
  } catch (error) {
    if (error instanceof WebhookSignatureError) return NextResponse.json({ ok: false }, { status: 401 });
    console.error("Payment webhook failed", error);
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
