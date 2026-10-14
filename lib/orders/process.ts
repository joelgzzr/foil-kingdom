import "server-only";

import { getPaymentProvider } from "@/lib/payments";
import { getShippingProvider } from "@/lib/shipping";
import type { TrackingEvent } from "@/lib/shipping/types";
import type { PaymentEvent } from "@/lib/payments/types";
import { toShippingAddress } from "@/lib/orders/addresses";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type Admin = ReturnType<typeof createAdminClient>;

async function notifyOrderParties(admin: Admin, order: { id: string; conversation_id: string; buyer_id: string; seller_id: string; listing_title: string }, status: string, recipients: "both" | "buyer" | "seller" = "both") {
  const userIds = recipients === "both" ? [order.buyer_id, order.seller_id] : [recipients === "buyer" ? order.buyer_id : order.seller_id];
  await admin.from("notifications").insert(
    userIds.map((user_id) => ({
      user_id,
      type: "order",
      conversation_id: order.conversation_id,
      data: { status, listing_title: order.listing_title },
    })),
  );
}

// Idempotent: replayed webhooks for an already-processed payment are ignored.
export async function applyPaymentEvent(providerId: string, event: PaymentEvent) {
  const admin = createAdminClient();

  const { data: payment } = await admin
    .from("payments")
    .select("id, order_id, status, amount_cents")
    .eq("provider", providerId)
    .eq("provider_payment_id", event.providerPaymentId)
    .maybeSingle();
  if (!payment) return { handled: false as const, reason: "unknown_payment" };
  // `expired` payments can still be approved late by the processor; those are refunded below.
  if (payment.status !== "pending" && payment.status !== "expired") return { handled: true as const, reason: "already_processed" };

  if (event.status === "rejected") {
    await admin.from("payments").update({ status: "rejected" }).eq("id", payment.id).eq("status", "pending");
    return { handled: true as const, reason: "rejected" };
  }

  if (event.amountCents !== payment.amount_cents) {
    console.error("Payment amount mismatch", { paymentId: payment.id, expected: payment.amount_cents, received: event.amountCents });
    return { handled: false as const, reason: "amount_mismatch" };
  }

  const { data: approved } = await admin
    .from("payments")
    .update({ status: "approved" })
    .eq("id", payment.id)
    .in("status", ["pending", "expired"])
    .select("id");
  if (!approved?.length) return { handled: true as const, reason: "already_processed" };

  const { data: order } = await admin
    .from("orders")
    .update({ status: "paid" })
    .eq("id", payment.order_id)
    .eq("status", "awaiting_payment")
    .eq("total_cents", payment.amount_cents)
    .select("id, conversation_id, buyer_id, seller_id, listing_title, selected_quote_id")
    .maybeSingle();
  if (!order) {
    // Money was taken for an order that can no longer be paid: queued for a refund in /admin.
    await admin.from("payments").update({ refund_needed: true }).eq("id", payment.id);
    console.error("Approved payment for a non-payable order", { paymentId: payment.id, orderId: payment.order_id });
    return { handled: true as const, reason: "order_not_payable" };
  }

  await purchaseLabel(admin, order);
  return { handled: true as const, reason: "paid" };
}

async function purchaseLabel(
  admin: Admin,
  order: { id: string; conversation_id: string; buyer_id: string; seller_id: string; listing_title: string; selected_quote_id: string | null },
) {
  try {
    const [{ data: full }, { data: addresses }, { data: quote }] = await Promise.all([
      admin.from("orders").select("weight_grams, length_cm, width_cm, height_cm").eq("id", order.id).single(),
      admin.from("order_addresses").select("*").eq("order_id", order.id),
      admin.from("shipping_quotes").select("provider, provider_rate_id").eq("id", order.selected_quote_id ?? "").single(),
    ]);
    const origin = addresses?.find((address) => address.party === "origin");
    const destination = addresses?.find((address) => address.party === "destination");
    if (!full || !origin || !destination || !quote) throw new Error("Order data incomplete");

    const label = await getShippingProvider(quote.provider).createLabel({
      providerRateId: quote.provider_rate_id,
      origin: toShippingAddress(origin),
      destination: toShippingAddress(destination),
      parcel: { weightGrams: full.weight_grams, lengthCm: full.length_cm, widthCm: full.width_cm, heightCm: full.height_cm },
      reference: order.id,
    });

    const { error: shipmentError } = await admin.from("shipments").insert({
      order_id: order.id,
      provider: quote.provider,
      provider_shipment_id: label.providerShipmentId,
      carrier: label.carrier,
      service: label.service,
      tracking_number: label.trackingNumber,
      label_url: label.labelUrl,
    });
    if (shipmentError) throw shipmentError;

    await admin.from("orders").update({ status: "label_ready", label_error: null }).eq("id", order.id);
    await notifyOrderParties(admin, order, "label_ready");
    // Marks the sale as done in the chat; the conversation is free for a new order from here on.
    await admin
      .from("messages")
      .insert({ conversation_id: order.conversation_id, sender_id: order.seller_id, kind: "system", body: "sale_completed" });
  } catch (error) {
    console.error("Label purchase failed", { orderId: order.id, error });
    await admin
      .from("orders")
      .update({ status: "label_failed", label_error: error instanceof Error ? error.message.slice(0, 300) : "unknown" })
      .eq("id", order.id);
    await notifyOrderParties(admin, order, "label_failed");
  }
}

const STATUS_RANK = { label_created: 0, exception: 0, in_transit: 1, delivered: 2 } as const;

export async function applyTrackingEvent(providerId: string, event: TrackingEvent) {
  const admin = createAdminClient();

  const { data: shipment } = await admin
    .from("shipments")
    .select("id, order_id, status")
    .eq("provider", providerId)
    .eq("tracking_number", event.trackingNumber)
    .maybeSingle();
  if (!shipment) return { handled: false as const, reason: "unknown_shipment" };

  await admin
    .from("shipment_events")
    .upsert(
      { shipment_id: shipment.id, status: event.status, description: event.description, occurred_at: event.occurredAt },
      { onConflict: "shipment_id,status,occurred_at", ignoreDuplicates: true },
    );

  // Never move a shipment backwards (late or replayed events).
  const regresses = STATUS_RANK[event.status] < STATUS_RANK[shipment.status as keyof typeof STATUS_RANK];
  if (regresses || shipment.status === "delivered") return { handled: true as const, reason: "stale" };
  await admin.from("shipments").update({ status: event.status }).eq("id", shipment.id);

  if (event.status === "exception") return { handled: true as const, reason: "exception" };

  const fromStatuses: ("label_ready" | "in_transit")[] = event.status === "in_transit" ? ["label_ready"] : ["label_ready", "in_transit"];
  const { data: order } = await admin
    .from("orders")
    .update({ status: event.status })
    .eq("id", shipment.order_id)
    .in("status", fromStatuses)
    .select("id, conversation_id, buyer_id, seller_id, listing_title")
    .maybeSingle();
  if (order) await notifyOrderParties(admin, order, event.status);

  return { handled: true as const, reason: event.status };
}

// Admin action: a paid order whose label purchase failed goes back to `paid` and is retried once.
export async function retryLabelPurchase(orderId: string) {
  const admin = createAdminClient();
  const { data: order } = await admin
    .from("orders")
    .update({ status: "paid" })
    .eq("id", orderId)
    .eq("status", "label_failed")
    .select("id, conversation_id, buyer_id, seller_id, listing_title, selected_quote_id")
    .maybeSingle();
  if (!order) return { retried: false as const };

  await purchaseLabel(admin, order);
  const { data: after } = await admin.from("orders").select("status").eq("id", orderId).single();
  return { retried: true as const, succeeded: after?.status === "label_ready" };
}

// Moderator action: cancels a labelled order. The database change comes first; the label void
// and refund are best effort and any refund we can't make is queued for a manual one.
export async function revokeOrder(
  moderator: Awaited<ReturnType<typeof createClient>>,
  orderId: string,
  reason: string,
) {
  const admin = createAdminClient();
  const { data: shipment } = await admin
    .from("shipments")
    .select("provider, provider_shipment_id")
    .eq("order_id", orderId)
    .maybeSingle();

  const { error } = await moderator.rpc("admin_revoke_order", { p_order_id: orderId, p_reason: reason });
  if (error) return { revoked: false as const };

  let manualFollowUp = false;

  if (shipment) {
    try {
      const provider = getShippingProvider(shipment.provider);
      if (provider.voidLabel && shipment.provider_shipment_id) await provider.voidLabel(shipment.provider_shipment_id);
      else manualFollowUp = true;
    } catch (voidError) {
      console.error("Label void failed", { orderId, error: voidError });
      manualFollowUp = true;
    }
  }

  const { data: payments } = await admin
    .from("payments")
    .select("id, provider, provider_payment_id")
    .eq("order_id", orderId)
    .eq("status", "approved");
  for (const payment of payments ?? []) {
    try {
      const provider = getPaymentProvider(payment.provider);
      if (!provider.refund || !payment.provider_payment_id) throw new Error("Refund not supported");
      await provider.refund(payment.provider_payment_id);
      await admin.from("payments").update({ status: "refunded", refund_needed: false }).eq("id", payment.id);
    } catch (refundError) {
      console.error("Refund failed", { orderId, paymentId: payment.id, error: refundError });
      await admin.from("payments").update({ refund_needed: true }).eq("id", payment.id);
      manualFollowUp = true;
    }
  }

  return { revoked: true as const, manualFollowUp };
}
