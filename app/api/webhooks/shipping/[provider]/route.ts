import { NextResponse } from "next/server";

import { applyTrackingEvent } from "@/lib/orders/process";
import { getShippingProvider } from "@/lib/shipping";
import { WebhookSignatureError } from "@/lib/webhook-signature";

export async function POST(request: Request, ctx: RouteContext<"/api/webhooks/shipping/[provider]">) {
  const { provider: providerId } = await ctx.params;
  const rawBody = await request.text();

  try {
    const provider = getShippingProvider(providerId);
    const event = provider.parseWebhook(rawBody, request.headers);
    if (!event) return NextResponse.json({ ok: true, ignored: true });

    const result = await applyTrackingEvent(provider.id, event);
    return NextResponse.json({ ok: result.handled, reason: result.reason }, { status: result.handled ? 200 : 422 });
  } catch (error) {
    if (error instanceof WebhookSignatureError) return NextResponse.json({ ok: false }, { status: 401 });
    console.error("Shipping webhook failed", error);
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
