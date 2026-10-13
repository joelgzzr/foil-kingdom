import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";

import { cardImageUrl } from "@/lib/data/catalog";
import { COLLECTION_PAGE_SIZE, type CollectionFilters } from "@/lib/schemas/collection";
import { CONDITIONS, FINISHES, LANGUAGES } from "@/lib/schemas/listing";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";
import { supabaseUrl } from "@/lib/supabase/env";

const idSchema = z.uuid();

export function listingPhotoUrl(storagePath: string) {
  return `${supabaseUrl()}/storage/v1/object/public/listing-photos/${storagePath}`;
}

type PhotoRow = { storage_path: string; position: number };

const firstPhoto = (photos: PhotoRow[]) => [...photos].sort((a, b) => a.position - b.position)[0];

const LISTING_TILE_COLUMNS = `
  id, kind, title, price_cents, accepts_offers, published_at,
  profiles!inner(username, state, city),
  listing_photos(storage_path, position),
  listing_items(condition, card_prints(image_path))
`;

export type PrintListingStats = { minPriceCents: number; totalCopies: number; sellerCount: number };

// Separate from the catalog cache so prices stay fresh while card data is cached for hours.
export async function getPrintListingStats(printIds: string[]) {
  "use cache";
  cacheLife("minutes");
  cacheTag("listings");

  const stats: Record<string, PrintListingStats> = {};
  if (printIds.length === 0) return stats;

  const { data, error } = await createPublicClient()
    .from("print_listing_stats")
    .select("print_id, min_price_cents, total_copies, seller_count")
    .in("print_id", printIds);
  if (error) throw new Error("Failed to load card listing stats");

  for (const row of data) {
    if (!row.print_id) continue;
    stats[row.print_id] = {
      minPriceCents: row.min_price_cents ?? 0,
      totalCopies: row.total_copies ?? 0,
      sellerCount: row.seller_count ?? 0,
    };
  }
  return stats;
}

export type CardOfferFilters = { condition?: string; language?: string; finish?: string };

const isOneOf = <T extends string>(values: readonly T[], value: string | undefined): value is T =>
  value !== undefined && (values as readonly string[]).includes(value);

// Every active single listing of a print, cheapest first.
export async function getPrintListings(printId: string, filters: CardOfferFilters) {
  "use cache";
  cacheLife("minutes");
  cacheTag("listings");

  if (!idSchema.safeParse(printId).success) return [];

  let query = createPublicClient()
    .from("listing_items")
    .select(
      `id, condition, language, finish, quantity,
       listings!inner(id, price_cents, accepts_offers, description, published_at,
         profiles!inner(username, display_name, state, rating_avg, rating_count),
         listing_photos(id))`,
    )
    .eq("print_id", printId)
    .gt("quantity", 0)
    .eq("listings.status", "active")
    .eq("listings.kind", "single");

  if (isOneOf(CONDITIONS, filters.condition)) query = query.eq("condition", filters.condition);
  if (isOneOf(LANGUAGES, filters.language)) query = query.eq("language", filters.language);
  if (isOneOf(FINISHES, filters.finish)) query = query.eq("finish", filters.finish);

  const { data, error } = await query.limit(100);
  if (error) throw new Error("Failed to load card listings");

  return data
    .map((row) => ({
      listingId: row.listings.id,
      priceCents: row.listings.price_cents,
      acceptsOffers: row.listings.accepts_offers,
      note: row.listings.description,
      publishedAt: row.listings.published_at,
      hasPhotos: row.listings.listing_photos.length > 0,
      condition: row.condition,
      language: row.language,
      finish: row.finish,
      stock: row.quantity,
      seller: row.listings.profiles,
    }))
    .sort((a, b) => a.priceCents - b.priceCents);
}

export type CardOffer = Awaited<ReturnType<typeof getPrintListings>>[number];

type TileRow = {
  id: string;
  kind: "single" | "lot" | "sealed";
  title: string;
  price_cents: number;
  accepts_offers: boolean;
  profiles: { username: string; state: string | null; city: string | null };
  listing_photos: PhotoRow[];
  listing_items: { condition: string; card_prints: { image_path: string | null } | null }[];
};

function toListingTile(row: TileRow) {
  const photo = firstPhoto(row.listing_photos);
  const cardImage = row.listing_items[0]?.card_prints?.image_path ?? null;
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    priceCents: row.price_cents,
    acceptsOffers: row.accepts_offers,
    sellerUsername: row.profiles.username,
    sellerState: row.profiles.state,
    condition: row.listing_items[0]?.condition ?? "nm",
    // Seller photos win; singles fall back to the catalog image.
    imageUrl: photo ? listingPhotoUrl(photo.storage_path) : cardImageUrl(cardImage),
  };
}

export type ListingTileData = ReturnType<typeof toListingTile>;

// Tiles for the given listing ids, in the same order (the view that filters has no photos or seller data).
async function loadTiles(ids: string[]) {
  if (ids.length === 0) return [];
  const { data, error } = await createPublicClient().from("listings").select(LISTING_TILE_COLUMNS).in("id", ids);
  if (error) throw new Error("Failed to load listing tiles");
  const byId = new Map(data.map((row) => [row.id, toListingTile(row)]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

// Strips characters that carry meaning in PostgREST pattern filters.
const sanitizeTerm = (term: string) => term.replace(/[^\p{L}\p{N}\s\-'.]/gu, " ").trim().slice(0, 60);

export async function getSellerCollectionStats(sellerId: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag("listings");

  const { data, error } = await createPublicClient()
    .from("seller_collection_stats")
    .select("listing_count, total_copies")
    .eq("seller_id", sellerId)
    .maybeSingle();
  if (error) throw new Error("Failed to load collection stats");
  return { listingCount: data?.listing_count ?? 0, totalCopies: data?.total_copies ?? 0 };
}

// Keep in sync with set_listing_featured in the database.
const FEATURED_LIMIT = 5;

// Pinned listings of a seller, most recently pinned first.
export async function getFeaturedListings(sellerId: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag("listings");

  const { data, error } = await createPublicClient()
    .from("listing_search")
    .select("id")
    .eq("seller_id", sellerId)
    .not("featured_at", "is", null)
    .order("featured_at", { ascending: false })
    .limit(FEATURED_LIMIT);
  if (error) throw new Error("Failed to load featured listings");
  return loadTiles(data.flatMap((row) => (row.id ? [row.id] : [])));
}

// Filters arrive as arguments so every combination is its own cache entry.
export async function searchSellerCollection(sellerId: string, filters: CollectionFilters) {
  "use cache";
  cacheLife("minutes");
  cacheTag("listings");

  const from = (filters.page - 1) * COLLECTION_PAGE_SIZE;
  let query = createPublicClient()
    .from("listing_search")
    .select("id", { count: "exact" })
    .eq("seller_id", sellerId);

  const q = filters.q ? sanitizeTerm(filters.q) : "";
  // Pinned listings live in the showcase; a search still finds them.
  query = q ? query.ilike("search_text", `%${q.toLowerCase()}%`) : query.is("featured_at", null);

  const { data, count, error } = await query
    .order("published_at", { ascending: false })
    .order("id")
    .range(from, from + COLLECTION_PAGE_SIZE - 1);
  if (error) throw new Error("Failed to search seller collection");

  const total = count ?? 0;
  return {
    listings: await loadTiles(data.flatMap((row) => (row.id ? [row.id] : []))),
    total,
    page: filters.page,
    pageCount: Math.max(1, Math.ceil(total / COLLECTION_PAGE_SIZE)),
  };
}

const BROWSE_PAGE_SIZE = 12;
const RELATED_LIMIT = 10;
const FACET_VALUE = /^[\p{L}\p{N}_-]+$/u;

const isUuid = (value: string) => idSchema.safeParse(value).success;

// One page of a seller's active listings for the in-conversation browser; `exclude` hides cards already shown elsewhere.
export async function searchSellerBrowse(sellerId: string, options: { q?: string; page: number; exclude: string[] }) {
  const exclusions = options.exclude.filter(isUuid);
  const term = options.q ? sanitizeTerm(options.q) : "";
  const from = (options.page - 1) * BROWSE_PAGE_SIZE;

  let query = createPublicClient().from("listing_search").select("id").eq("seller_id", sellerId);
  if (term) query = query.ilike("search_text", `%${term.toLowerCase()}%`);
  if (exclusions.length > 0) query = query.not("id", "in", `(${exclusions.join(",")})`);

  // One extra row tells whether another page exists.
  const { data, error } = await query
    .order("published_at", { ascending: false })
    .order("id")
    .range(from, from + BROWSE_PAGE_SIZE);
  if (error) throw new Error("Failed to search seller listings");

  const ids = data.flatMap((row) => (row.id ? [row.id] : []));
  return { listings: await loadTiles(ids.slice(0, BROWSE_PAGE_SIZE)), hasMore: ids.length > BROWSE_PAGE_SIZE };
}

// Seller listings sharing a color or set with the cards already in the conversation.
async function getRelatedListings(sellerId: string, conversationListingIds: string[], exclude: string[]) {
  if (conversationListingIds.length === 0) return [];
  const supabase = createPublicClient();

  const { data: facets, error: facetsError } = await supabase
    .from("listing_search")
    .select("colors, set_ids")
    .in("id", conversationListingIds);
  if (facetsError) throw new Error("Failed to load conversation facets");

  const distinct = (values: (string[] | null)[]) =>
    [...new Set(values.flatMap((value) => value ?? []))].filter((value) => FACET_VALUE.test(value));
  const colors = distinct(facets.map((row) => row.colors));
  const setIds = distinct(facets.map((row) => row.set_ids));

  const clauses = [colors.length > 0 ? `colors.ov.{${colors.join(",")}}` : null, setIds.length > 0 ? `set_ids.ov.{${setIds.join(",")}}` : null].flatMap(
    (clause) => (clause ? [clause] : []),
  );
  if (clauses.length === 0) return [];

  let query = supabase.from("listing_search").select("id").eq("seller_id", sellerId).or(clauses.join(","));
  if (exclude.length > 0) query = query.not("id", "in", `(${exclude.join(",")})`);
  const { data, error } = await query.order("published_at", { ascending: false }).limit(RELATED_LIMIT);
  if (error) throw new Error("Failed to load related listings");
  return loadTiles(data.flatMap((row) => (row.id ? [row.id] : [])));
}

// Sections of the add-cards browser; no card appears twice and cards already in the conversation are left out.
export async function getSellerBrowseSections(sellerId: string, conversationListingIds: string[]) {
  const conversationIds = conversationListingIds.filter(isUuid);
  const taken = new Set(conversationIds);

  const featured = (await getFeaturedListings(sellerId)).filter((tile) => !taken.has(tile.id));
  for (const tile of featured) taken.add(tile.id);

  const related = await getRelatedListings(sellerId, conversationIds, [...taken]);
  for (const tile of related) taken.add(tile.id);

  const rest = await searchSellerBrowse(sellerId, { page: 1, exclude: [...taken] });
  return { featured, related, rest, conversationIds, sectionIds: [...taken] };
}

// Active listings of a seller that contain any of the given prints, newest first. Viewer-specific, so not cached.
export async function getSellerListingsForPrints(sellerId: string, printIds: string[], limit = 20) {
  if (printIds.length === 0) return [];
  const { data, error } = await createPublicClient()
    .from("listing_items")
    .select("listing_id, listings!inner(seller_id, status, published_at)")
    .in("print_id", printIds)
    .eq("listings.seller_id", sellerId)
    .eq("listings.status", "active");
  if (error) throw new Error("Failed to load wishlist matches");

  const publishedAt = new Map(data.map((row) => [row.listing_id, row.listings.published_at ?? ""]));
  const ids = [...publishedAt.keys()].sort((a, b) => (publishedAt.get(b) ?? "").localeCompare(publishedAt.get(a) ?? ""));
  return loadTiles(ids.slice(0, limit));
}

const LISTING_DETAIL_COLUMNS = `
  id, seller_id, kind, title, description, price_cents, accepts_offers, sealed_type, status, published_at,
  card_sets(name),
  profiles!inner(username, display_name, avatar_url, state, city, rating_avg, rating_count, phone_verified),
  listing_photos(id, storage_path, position),
  listing_items(id, print_id, condition, language, finish, quantity, card_prints(slug, variant_label, image_path, cards(code, name, rarity)))
`;

function toListingDetail<
  T extends {
    listing_photos: { id: string; storage_path: string; position: number }[];
    listing_items: { card_prints: { image_path: string | null } | null }[];
  },
>(row: T) {
  return {
    ...row,
    photos: [...row.listing_photos]
      .sort((a, b) => a.position - b.position)
      .map((photo) => ({ id: photo.id, url: listingPhotoUrl(photo.storage_path) })),
    items: row.listing_items.map(
      (item): T["listing_items"][number] & { cardImageUrl: string | null } => ({
        ...item,
        cardImageUrl: cardImageUrl(item.card_prints?.image_path ?? null),
      }),
    ),
  };
}

// Only active listings are visible to the anonymous client (RLS).
export async function getPublicListing(id: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag("listings");

  if (!idSchema.safeParse(id).success) return null;
  const { data, error } = await createPublicClient()
    .from("listings")
    .select(LISTING_DETAIL_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Failed to load listing");
  return data ? toListingDetail(data) : null;
}

// Request-bound (session cookies): call inside <Suspense>.
export async function getOwnListing(id: string, sellerId: string) {
  if (!idSchema.safeParse(id).success) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_DETAIL_COLUMNS)
    .eq("id", id)
    .eq("seller_id", sellerId)
    .maybeSingle();
  if (error) throw new Error("Failed to load listing");
  return data ? toListingDetail(data) : null;
}

export async function getOwnListings(sellerId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings")
    .select(
      "id, kind, title, price_cents, status, source, featured_at, created_at, listing_photos(storage_path, position), listing_items(quantity, card_prints(image_path))",
    )
    .eq("seller_id", sellerId)
    .eq("kind", "single")
    .order("created_at", { ascending: false });
  if (error) throw new Error("Failed to load listings");

  return data.map((row) => {
    const photo = firstPhoto(row.listing_photos);
    return {
      id: row.id,
      kind: row.kind,
      title: row.title,
      priceCents: row.price_cents,
      status: row.status,
      source: row.source,
      featured: row.featured_at !== null,
      stock: row.listing_items[0]?.quantity ?? 0,
      imageUrl: photo
        ? listingPhotoUrl(photo.storage_path)
        : cardImageUrl(row.listing_items[0]?.card_prints?.image_path ?? null),
    };
  });
}

export async function getSellerStanding(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("phone_verified").eq("id", userId).single();
  return { phoneVerified: Boolean(data?.phone_verified) };
}

// Prints the seller already has in a draft, active or paused listing, to warn about duplicates when scanning.
export async function getOwnListedPrintIds(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("listing_items")
    .select("print_id, listings!inner(seller_id, status)")
    .eq("listings.seller_id", userId)
    .in("listings.status", ["draft", "active", "paused"]);
  return [...new Set((data ?? []).map((row) => row.print_id))];
}

export async function getRecentListings(limit = 8) {
  "use cache";
  cacheLife("minutes");
  cacheTag("listings");

  const { data, error } = await createPublicClient()
    .from("listings")
    .select(LISTING_TILE_COLUMNS)
    .eq("kind", "single")
    .eq("status", "active")
    .order("published_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error("Failed to load recent listings");
  return data.map((row) => toListingTile(row));
}
