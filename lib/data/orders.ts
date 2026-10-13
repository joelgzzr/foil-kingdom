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

// All reads here are request-bound (session cookies): call inside <Suspense>.
export async function getConversationOrder(conversationId: string) {
  const supabase = await createClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select(ORDER_COLUMNS)
    .eq("conversation_id", conversationId)
    .neq("status", "cancelled")
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

export type ConversationOrder = NonNullable<Awaited<ReturnType<typeof getConversationOrder>>>;

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

export async function getUserOrders() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, conversation_id, listing_title, buyer_id, status, total_cents, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error("Failed to load orders");
  return data;
}
