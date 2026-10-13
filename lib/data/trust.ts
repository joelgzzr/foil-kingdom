import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { cardImageUrl } from "@/lib/data/catalog";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";

// Public seller profile + recent reviews. Banned sellers are hidden.
export async function getSellerProfile(username: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag("listings", "ratings");

  const supabase = createPublicClient();
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, state, city, bio, rating_avg, rating_count, created_at, banned_at")
    .eq("username", username)
    .maybeSingle();
  if (error) throw new Error("Failed to load seller");
  if (!profile || profile.banned_at) return null;

  const { data: ratings, error: ratingsError } = await supabase
    .from("ratings")
    .select("id, stars, comment, created_at, rater:profiles!ratings_rater_id_fkey(username, display_name)")
    .eq("ratee_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(20);
  if (ratingsError) throw new Error("Failed to load ratings");

  return { profile, ratings };
}

// Request-bound: delivered orders of this conversation that the user has not rated yet.
export async function getPendingRatingOrderIds(conversationId: string, userId: string) {
  const supabase = await createClient();
  const { data: delivered } = await supabase
    .from("orders")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("status", "delivered");
  if (!delivered?.length) return [];

  const { data: mine } = await supabase
    .from("ratings")
    .select("order_id")
    .eq("rater_id", userId)
    .in("order_id", delivered.map((order) => order.id));
  const rated = new Set((mine ?? []).map((rating) => rating.order_id));
  return delivered.filter((order) => !rated.has(order.id)).map((order) => order.id);
}

export async function getWishlist(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("wishlist_items")
    .select("print_id, max_price_cents, created_at, card_prints(slug, variant_label, image_path, cards(code, name, rarity))")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Failed to load wishlist");
  return data.flatMap((item) =>
    item.card_prints?.cards
      ? [
          {
            printId: item.print_id,
            maxPriceCents: item.max_price_cents,
            code: item.card_prints.cards.code,
            slug: item.card_prints.slug,
            variantLabel: item.card_prints.variant_label,
            name: item.card_prints.cards.name,
            rarity: item.card_prints.cards.rarity,
            imageUrl: cardImageUrl(item.card_prints.image_path),
          },
        ]
      : [],
  );
}

export type WishlistEntry = Awaited<ReturnType<typeof getWishlist>>[number];

export async function getWishlistEntry(userId: string, printId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("wishlist_items")
    .select("max_price_cents")
    .eq("user_id", userId)
    .eq("print_id", printId)
    .maybeSingle();
  return data;
}

// Standalone alerts and message/order notifications, newest first.
export async function getNotifications(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id, type, conversation_id, data, read_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error("Failed to load notifications");
  return data;
}
