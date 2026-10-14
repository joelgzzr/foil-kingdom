import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Callers must have passed requireModerator(). Reports and banned profiles are readable
// through RLS; label_failed orders are not (participants only), so they use the admin client.
export async function getOpenReports() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reports")
    .select(
      "id, target_type, target_id, target_label, target_owner_id, reason, details, created_at, reporter:profiles!reports_reporter_id_fkey(username)",
    )
    .eq("status", "open")
    .order("created_at", { ascending: true });
  if (error) throw new Error("Failed to load reports");
  return data;
}

export async function getBannedUsers() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, banned_at")
    .not("banned_at", "is", null)
    .order("banned_at", { ascending: false });
  if (error) throw new Error("Failed to load banned users");
  return data;
}

// Records the catalog sync could not match to a card. Service-role only (RLS grants nothing).
export async function getUnmatchedCatalogRecords() {
  const { data, error } = await createAdminClient()
    .from("catalog_source_records")
    .select("id, source, external_id, number, payload")
    .eq("match_method", "unmatched")
    .order("number")
    .limit(100);
  if (error) throw new Error("Failed to load catalog records");
  return data.map((record) => {
    const payload = record.payload as { name?: unknown } | null;
    return {
      id: record.id,
      source: record.source,
      externalId: record.external_id,
      number: record.number,
      name: typeof payload?.name === "string" ? payload.name : record.external_id,
    };
  });
}

export async function getLabelFailedOrders() {
  const { data, error } = await createAdminClient()
    .from("orders")
    .select("id, listing_title, label_error, total_cents, created_at")
    .eq("status", "label_failed")
    .order("created_at", { ascending: true });
  if (error) throw new Error("Failed to load orders");
  return data;
}

// Order reports point at orders the moderator is not a party to, so their summary comes from the admin client.
export async function getReportedOrderSummaries(orderIds: string[]) {
  if (orderIds.length === 0) return new Map<string, { status: string; buyer: string; seller: string; trackingNumber: string | null }>();
  const { data, error } = await createAdminClient()
    .from("orders")
    .select(
      "id, status, buyer:profiles!orders_buyer_id_fkey(username), seller:profiles!orders_seller_id_fkey(username), shipments(tracking_number)",
    )
    .in("id", orderIds);
  if (error) throw new Error("Failed to load orders");
  return new Map(
    data.map((order) => [
      order.id,
      { status: order.status, buyer: order.buyer.username, seller: order.seller.username, trackingNumber: order.shipments?.tracking_number ?? null },
    ]),
  );
}

export async function getPendingRefunds() {
  const { data, error } = await createAdminClient()
    .from("payments")
    .select("id, amount_cents, created_at, orders(listing_title)")
    .eq("refund_needed", true)
    .order("created_at", { ascending: true });
  if (error) throw new Error("Failed to load refunds");
  return data;
}
