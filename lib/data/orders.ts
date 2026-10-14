import "server-only";

import { createClient } from "@/lib/supabase/server";

const ORDER_COLUMNS =
  "id, conversation_id, listing_title, buyer_id, seller_id, item_price_cents, package_preset, weight_grams, origin_summary, destination_summary, status, selected_quote_id, total_cents, label_error, created_at, order_items(id, title, quantity, created_at)";

// True while an order waits for the buyer or payment, which locks the conversation's cards.
export async function hasPendingOrder(conversationId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id")
    .eq("conversation_id", conversationId)
    .in("status", ["awaiting_buyer", "awaiting_payment"])
    .limit(1);
  if (error) throw new Error("Failed to load order");
  return data.length > 0;
}

const ACTIVE_STATUSES = ["awaiting_buyer", "awaiting_payment", "paid", "label_failed"] as const;
const COMPLETED_STATUSES = ["label_ready", "in_transit", "delivered"] as const;

// The order still being worked on; labelled orders are done and leave the conversation free for a new one.
// All reads here are request-bound (session cookies): call inside <Suspense>.
export async function getActiveConversationOrder(conversationId: string) {
  const supabase = await createClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select(ORDER_COLUMNS)
    .eq("conversation_id", conversationId)
    .in("status", ACTIVE_STATUSES)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("Failed to load order");
  if (!order) return null;

  const [charges, quotes, shipment] = await Promise.all([
    supabase.from("order_charges").select("kind, description, amount_cents").eq("order_id", order.id).order("kind", { ascending: false }),
    supabase
      .from("shipping_quotes")
      .select("id, carrier, service, price_cents, estimated_days")
      .eq("order_id", order.id)
      .gt("expires_at", new Date().toISOString())
      .order("price_cents"),
    supabase.from("shipments").select("carrier, service, tracking_number, status").eq("order_id", order.id).maybeSingle(),
  ]);

  return {
    ...order,
    charges: charges.data ?? [],
    quotes: quotes.data ?? [],
    shipment: shipment.data,
  };
}

export type ConversationOrder = NonNullable<Awaited<ReturnType<typeof getActiveConversationOrder>>>;

export async function getCompletedConversationOrders(conversationId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, status, created_at, order_items(quantity)")
    .eq("conversation_id", conversationId)
    .in("status", COMPLETED_STATUSES)
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) throw new Error("Failed to load orders");
  return data;
}

export async function getUserAddresses(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("addresses")
    .select("id, label, recipient_name, street, exterior_number, municipality, state, postal_code, is_default")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at");
  if (error) throw new Error("Failed to load addresses");
  return data;
}

export type UserAddressOption = Awaited<ReturnType<typeof getUserAddresses>>[number];

export type OrderRole = "buy" | "sell";

export async function getUserOrders(userId: string, role: OrderRole) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, conversation_id, listing_title, status, total_cents, item_price_cents, created_at, order_items(quantity), buyer:profiles!orders_buyer_id_fkey(username, display_name), seller:profiles!orders_seller_id_fkey(username, display_name)",
    )
    .eq(role === "buy" ? "buyer_id" : "seller_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error("Failed to load orders");
  return data;
}

export async function getOrderDetail(orderId: string, userId: string) {
  const supabase = await createClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select(
      "id, conversation_id, listing_title, buyer_id, seller_id, item_price_cents, package_preset, origin_summary, destination_summary, status, total_cents, label_error, cancel_reason, cancelled_by, cancelled_at, created_at, order_items(id, title, quantity, created_at), buyer:profiles!orders_buyer_id_fkey(username, display_name), seller:profiles!orders_seller_id_fkey(username, display_name)",
    )
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error("Failed to load order");
  if (!order) return null;

  const [charges, shipment, report, rating] = await Promise.all([
    supabase.from("order_charges").select("kind, description, amount_cents").eq("order_id", order.id).order("kind", { ascending: false }),
    supabase
      .from("shipments")
      .select("carrier, service, tracking_number, status, shipment_events(status, description, occurred_at)")
      .eq("order_id", order.id)
      .maybeSingle(),
    supabase
      .from("reports")
      .select("id")
      .eq("target_type", "order")
      .eq("target_id", order.id)
      .eq("reporter_id", userId)
      .eq("status", "open")
      .limit(1),
    supabase.from("ratings").select("id").eq("order_id", order.id).eq("rater_id", userId).limit(1),
  ]);

  return {
    ...order,
    role: order.buyer_id === userId ? ("buyer" as const) : ("seller" as const),
    charges: charges.data ?? [],
    shipment: shipment.data,
    hasOpenReport: (report.data?.length ?? 0) > 0,
    hasRated: (rating.data?.length ?? 0) > 0,
  };
}
