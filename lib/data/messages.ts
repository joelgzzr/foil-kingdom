import "server-only";

import { cache } from "react";

import { cardImageUrl } from "@/lib/data/catalog";
import { listingPhotoUrl } from "@/lib/data/listings";
import { CHAT_MESSAGE_COLUMNS, type ChatMessage } from "@/lib/schemas/message";
import { createClient } from "@/lib/supabase/server";

const CONVERSATION_COLUMNS = `
  id, listing_title, buyer_id, seller_id, buyer_last_read_at, seller_last_read_at,
  last_message_at, last_message_sender_id, last_message_kind, last_message_preview, agreed_bundle_cents,
  buyer:profiles!conversations_buyer_id_fkey(username, display_name),
  seller:profiles!conversations_seller_id_fkey(username, display_name)
`;

// Listing columns are null for the buyer once a listing stops being active (RLS), so the item still renders.
const CONVERSATION_ITEM_COLUMNS = `
  id, listing_id, title, quantity, agreed_price_cents, created_at,
  listings(id, kind, status, price_cents,
    listing_photos(storage_path, position),
    listing_items(quantity, card_prints(image_path)))
`;

export type ConversationItemView = {
  id: string;
  listingId: string;
  title: string;
  quantity: number;
  agreedPriceCents: number | null;
  unitPriceCents: number | null;
  available: boolean;
  stock: number;
  imageUrl: string | null;
};

// Open cards the user already negotiates as buyer, mapped to their conversation (listing id -> conversation id).
export const getOpenConversationLinks = cache(async (userId: string): Promise<Record<string, string>> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("conversation_items")
    .select("listing_id, conversation_id, conversations!inner(buyer_id)")
    .eq("conversations.buyer_id", userId)
    .is("order_id", null);
  if (error) throw new Error("Failed to load conversation items");
  return Object.fromEntries(data.flatMap((row) => (row.listing_id ? [[row.listing_id, row.conversation_id]] : [])));
});

// All reads here are request-bound (session cookies): call inside <Suspense>.
export async function getConversations(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("conversations")
    .select(CONVERSATION_COLUMNS)
    .order("last_message_at", { ascending: false });
  if (error) throw new Error("Failed to load conversations");

  return data.map((conversation) => {
    const isBuyer = conversation.buyer_id === userId;
    const other = isBuyer ? conversation.seller : conversation.buyer;
    const lastRead = isBuyer ? conversation.buyer_last_read_at : conversation.seller_last_read_at;
    return {
      id: conversation.id,
      listingTitle: conversation.listing_title,
      otherName: other.display_name ?? other.username,
      lastMessageKind: conversation.last_message_kind,
      lastMessagePreview: conversation.last_message_preview,
      lastMessageAt: conversation.last_message_at,
      unread: conversation.last_message_sender_id !== userId && conversation.last_message_at > lastRead,
    };
  });
}

export async function getConversation(id: string, userId: string) {
  const supabase = await createClient();
  const { data: conversation, error } = await supabase
    .from("conversations")
    .select(CONVERSATION_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Failed to load conversation");
  if (!conversation) return null;

  const [{ data: latest, error: messagesError }, { data: itemRows, error: itemsError }] = await Promise.all([
    supabase
      .from("messages")
      .select(CHAT_MESSAGE_COLUMNS)
      .eq("conversation_id", id)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("conversation_items")
      .select(CONVERSATION_ITEM_COLUMNS)
      .eq("conversation_id", id)
      .is("order_id", null)
      .order("created_at"),
  ]);
  if (messagesError) throw new Error("Failed to load messages");
  if (itemsError) throw new Error("Failed to load conversation items");

  const isBuyer = conversation.buyer_id === userId;
  const other = isBuyer ? conversation.seller : conversation.buyer;
  const messages: ChatMessage[] = (latest ?? []).reverse();

  const items: ConversationItemView[] = (itemRows ?? []).map((row) => {
    const listing = row.listings;
    const photo = listing ? [...listing.listing_photos].sort((a, b) => a.position - b.position)[0] : undefined;
    const first = listing?.listing_items[0];
    return {
      id: row.id,
      listingId: row.listing_id,
      title: row.title,
      quantity: row.quantity,
      agreedPriceCents: row.agreed_price_cents,
      unitPriceCents: listing?.price_cents ?? null,
      available: listing?.status === "active",
      stock: listing?.kind === "single" ? (first?.quantity ?? 0) : 1,
      imageUrl: photo ? listingPhotoUrl(photo.storage_path) : cardImageUrl(first?.card_prints?.image_path ?? null),
    };
  });

  // Price the sides negotiate on: the agreed bundle total, else per-card agreements falling back to list price.
  const listTotalCents = items.reduce((sum, item) => sum + (item.unitPriceCents ?? 0) * item.quantity, 0);
  const agreedTotalCents =
    conversation.agreed_bundle_cents ??
    items.reduce((sum, item) => sum + (item.agreedPriceCents ?? (item.unitPriceCents ?? 0) * item.quantity), 0);

  return {
    id: conversation.id,
    role: isBuyer ? ("buyer" as const) : ("seller" as const),
    otherName: other.display_name ?? other.username,
    sellerId: conversation.seller_id,
    sellerUsername: conversation.seller.username,
    listingTitle: conversation.listing_title,
    items,
    listTotalCents,
    agreedTotalCents,
    hasAgreedBundle: conversation.agreed_bundle_cents !== null,
    messages,
  };
}

// Unread notifications split in two: tied to a conversation (messages, orders) and standalone alerts.
export async function getUnreadCounts(userId: string) {
  const supabase = await createClient();
  const base = () =>
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId).is("read_at", null);
  const [conversations, alerts] = await Promise.all([
    base().not("conversation_id", "is", null),
    base().is("conversation_id", null),
  ]);
  return { conversations: conversations.count ?? 0, alerts: alerts.count ?? 0 };
}
