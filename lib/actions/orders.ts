"use server";

import { z } from "zod";

import { fail, ok } from "@/lib/action-result";
import { requireActiveUser } from "@/lib/auth-guard";
import { es } from "@/lib/i18n/es";
import { toShippingAddress } from "@/lib/orders/addresses";
import { applyPaymentEvent } from "@/lib/orders/process";
import { getPaymentProvider } from "@/lib/payments";
import { createOrderSchema } from "@/lib/schemas/order";
import { getShippingProvider } from "@/lib/shipping";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { assertMockAllowed } from "@/lib/webhook-signature";

const idSchema = z.uuid();
const QUOTE_TTL_MS = 30 * 60 * 1000;

export async function createOrderAction(conversationId: unknown, input: unknown) {
  await requireActiveUser();
  const parsedId = idSchema.safeParse(conversationId);
  const parsed = createOrderSchema.safeParse(input);
  if (!parsedId.success) return fail(es.errors.generic, "validation");
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? es.errors.generic, "validation");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_order", {
    p_conversation_id: parsedId.data,
    p_item_price_cents: Math.round(parsed.data.price * 100),
    p_package_preset: parsed.data.packagePreset,
    p_origin_address_id: parsed.data.originAddressId,
  });
  if (error || !data) {
    if (error?.code === "23514") return fail(es.orders.create.notEnoughStock, "conflict");
    if (error?.code === "23505") return fail(es.orders.create.alreadyOpen, "conflict");
    if (error?.code === "42501") return fail(es.orders.create.sellerOnly, "unauthorized");
    if (error?.code === "P0002" && error.message.includes("No items")) return fail(es.orders.create.noItems, "not_found");
    return fail(es.errors.generic);
  }
  return ok({ id: data }, es.orders.create.created);
}

// Stores the buyer's destination, then fetches and stores fresh carrier quotes.
export async function setOrderDestinationAction(orderId: unknown, addressId: unknown) {
  await requireActiveUser();
  const parsedOrder = idSchema.safeParse(orderId);
  const parsedAddress = idSchema.safeParse(addressId);
  if (!parsedOrder.success || !parsedAddress.success) return fail(es.errors.generic, "validation");

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_order_destination", {
    p_order_id: parsedOrder.data,
    p_address_id: parsedAddress.data,
  });
  if (error) return fail(es.errors.generic, error.code === "P0002" ? "not_found" : "unexpected");

  // The RPC succeeded, so the caller is the buyer; the admin client only writes the quotes.
  const admin = createAdminClient();
  const [{ data: order }, { data: addresses }] = await Promise.all([
    admin.from("orders").select("weight_grams, length_cm, width_cm, height_cm").eq("id", parsedOrder.data).single(),
    admin.from("order_addresses").select("*").eq("order_id", parsedOrder.data),
  ]);
  const origin = addresses?.find((address) => address.party === "origin");
  const destination = addresses?.find((address) => address.party === "destination");
  if (!order || !origin || !destination) return fail(es.errors.generic);

  try {
    const provider = getShippingProvider();
    const rates = await provider.getRates({
      origin: toShippingAddress(origin),
      destination: toShippingAddress(destination),
      parcel: { weightGrams: order.weight_grams, lengthCm: order.length_cm, widthCm: order.width_cm, heightCm: order.height_cm },
    });
    if (rates.length === 0) return fail(es.orders.buyer.noRates);

    const expiresAt = new Date(Date.now() + QUOTE_TTL_MS).toISOString();
    const { error: insertError } = await admin.from("shipping_quotes").insert(
      rates.map((rate) => ({
        order_id: parsedOrder.data,
        provider: provider.id,
        provider_rate_id: rate.providerRateId,
        carrier: rate.carrier,
        service: rate.service,
        price_cents: rate.priceCents,
        estimated_days: rate.estimatedDays,
        expires_at: expiresAt,
      })),
    );
    if (insertError) return fail(es.errors.generic);
  } catch (quoteError) {
    console.error("Shipping quote failed", quoteError);
    return fail(es.orders.buyer.quoteError);
  }
  return ok();
}

export async function selectOrderQuoteAction(orderId: unknown, quoteId: unknown) {
  await requireActiveUser();
  const parsedOrder = idSchema.safeParse(orderId);
  const parsedQuote = idSchema.safeParse(quoteId);
  if (!parsedOrder.success || !parsedQuote.success) return fail(es.errors.generic, "validation");

  const supabase = await createClient();
  const { error } = await supabase.rpc("select_order_quote", { p_order_id: parsedOrder.data, p_quote_id: parsedQuote.data });
  if (error) return fail(error.code === "P0002" ? es.orders.buyer.quoteExpired : es.errors.generic);
  return ok();
}

export async function startCheckoutAction(orderId: unknown) {
  const user = await requireActiveUser();
  const parsed = idSchema.safeParse(orderId);
  if (!parsed.success) return fail(es.errors.generic, "validation");

  // RLS read proves the caller is the buyer; the total was computed in the database.
  const supabase = await createClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, listing_title, total_cents, status")
    .eq("id", parsed.data)
    .eq("buyer_id", user.id)
    .eq("status", "awaiting_payment")
    .maybeSingle();
  if (!order?.total_cents) return fail(es.errors.generic, "not_found");

  try {
    const provider = getPaymentProvider();
    const admin = createAdminClient();
    const paymentId = crypto.randomUUID();
    const { error: insertError } = await admin
      .from("payments")
      .insert({ id: paymentId, order_id: order.id, provider: provider.id, amount_cents: order.total_cents });
    if (insertError) return fail(es.errors.generic);

    const checkout = await provider.createCheckout({
      paymentId,
      orderId: order.id,
      amountCents: order.total_cents,
      description: es.orders.checkoutDescription(order.listing_title),
    });
    await admin.from("payments").update({ provider_payment_id: checkout.providerPaymentId }).eq("id", paymentId);
    return ok({ url: checkout.checkoutUrl });
  } catch (checkoutError) {
    console.error("Checkout failed", checkoutError);
    return fail(es.orders.buyer.checkoutError);
  }
}

export async function cancelOrderAction(orderId: unknown) {
  await requireActiveUser();
  const parsed = idSchema.safeParse(orderId);
  if (!parsed.success) return fail(es.errors.generic, "validation");

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_order", { p_order_id: parsed.data });
  if (error) return fail(es.errors.generic);
  return ok(undefined, es.orders.cancelled);
}

// Dev-only stand-in for the processor's redirect + webhook, using the same code path as the real webhook.
export async function confirmMockPaymentAction(paymentId: unknown, outcome: unknown) {
  const user = await requireActiveUser();
  const parsedId = idSchema.safeParse(paymentId);
  const parsedOutcome = z.enum(["approved", "rejected"]).safeParse(outcome);
  if (!parsedId.success || !parsedOutcome.success) return fail(es.errors.generic, "validation");

  const provider = getPaymentProvider();
  if (provider.id !== "mock") return fail(es.errors.generic, "unauthorized");
  assertMockAllowed("payment");

  const supabase = await createClient();
  const { data: payment } = await supabase
    .from("payments")
    .select("id, order_id, amount_cents, status, orders!inner(conversation_id, buyer_id)")
    .eq("id", parsedId.data)
    .maybeSingle();
  if (!payment || payment.orders.buyer_id !== user.id || payment.status !== "pending") return fail(es.errors.generic, "not_found");

  const admin = createAdminClient();
  const { data: secret } = await admin.from("payments").select("provider_payment_id").eq("id", payment.id).single();
  if (!secret?.provider_payment_id) return fail(es.errors.generic);

  await applyPaymentEvent(provider.id, {
    providerPaymentId: secret.provider_payment_id,
    status: parsedOutcome.data,
    amountCents: payment.amount_cents,
  });
  return ok({ conversationId: payment.orders.conversation_id });
}
