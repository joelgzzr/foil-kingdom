import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import { z } from "zod";

import { cardLabel } from "@/lib/card-label";
import { createPublicClient } from "@/lib/supabase/public";
import { supabaseUrl } from "@/lib/supabase/env";

export const CATALOG_PAGE_SIZE = 24;

export type CardFilters = {
  q?: string;
  color?: string;
  rarity?: string;
  type?: string;
  set?: string;
  // Only cards with at least one active listing.
  listed?: boolean;
  // Hide alternate arts, parallels and reprints.
  baseOnly?: boolean;
  // Only pre-release, release-event and celebration-event arts (matched on the variant label the sync writes).
  eventsOnly?: boolean;
  page?: number;
};

const EVENT_LABEL_FILTER = ["pre-release", "release event", "celebration event"]
  .map((label) => `variant_label.ilike.%${label}%`)
  .join(",");

// Every catalog read goes through the catalog_prints view: one row per print, joined with its card.
const PRINT_LIST_COLUMNS = "id, code, slug, variant_label, name, card_type, color, color2, rarity, image_path";

export function cardImageUrl(imagePath: string | null) {
  return imagePath ? `${supabaseUrl()}/storage/v1/object/public/card-images/${imagePath}` : null;
}

// Strips characters that carry meaning in PostgREST filters (commas, parentheses, wildcards).
function sanitizeSearchTerm(term: string) {
  return term.replace(/[^\p{L}\p{N}\s\-'.]/gu, " ").trim().slice(0, 60);
}

export async function searchCards(filters: CardFilters) {
  "use cache";
  // Availability changes faster than card data, so listed searches follow the listings cache.
  if (filters.listed) cacheLife("minutes");
  else cacheLife("hours");
  cacheTag("catalog");
  if (filters.listed) cacheTag("listings");

  const page = Math.max(1, Math.floor(filters.page ?? 1));
  const from = (page - 1) * CATALOG_PAGE_SIZE;
  let query = createPublicClient().from("catalog_prints").select(PRINT_LIST_COLUMNS, { count: "exact" });

  if (filters.set && z.uuid().safeParse(filters.set).success) query = query.contains("set_ids", [filters.set]);
  if (filters.listed) query = query.eq("is_listed", true);

  const q = filters.q ? sanitizeSearchTerm(filters.q) : "";
  if (q) query = query.or(`name.ilike.%${q}%,code.ilike.%${q}%,variant_label.ilike.%${q}%`);
  if (filters.eventsOnly) query = query.or(EVENT_LABEL_FILTER);
  if (filters.color) query = query.eq("color", filters.color);
  if (filters.rarity) query = query.eq("rarity", filters.rarity);
  if (filters.type) query = query.eq("card_type", filters.type);
  if (filters.baseOnly) query = query.eq("is_default", true);

  // Default print first, then variants, so alternate arts sit next to their card.
  const { data, count, error } = await query
    .order("code", { ascending: true })
    .order("is_default", { ascending: false })
    .order("slug", { ascending: true })
    .range(from, from + CATALOG_PAGE_SIZE - 1);
  if (error) throw new Error("Failed to search cards");

  return {
    cards: (data ?? []).map((row) => ({
      id: row.id!,
      code: row.code!,
      slug: row.slug!,
      variantLabel: row.variant_label,
      name: row.name!,
      cardType: row.card_type,
      color: row.color,
      color2: row.color2,
      rarity: row.rarity,
      imageUrl: cardImageUrl(row.image_path),
    })),
    total: count ?? 0,
    page,
    pageCount: Math.max(1, Math.ceil((count ?? 0) / CATALOG_PAGE_SIZE)),
  };
}

export type CardSummary = Awaited<ReturnType<typeof searchCards>>["cards"][number];

export async function getCatalogFacets() {
  "use cache";
  cacheLife("days");
  cacheTag("catalog");

  const supabase = createPublicClient();
  const [facets, sets] = await Promise.all([
    supabase.from("card_facets").select("facet, value"),
    supabase.from("card_sets").select("id, name").order("name"),
  ]);
  if (facets.error || sets.error) throw new Error("Failed to load catalog facets");

  const valuesFor = (facet: string) =>
    facets.data
      .filter((row) => row.facet === facet && row.value)
      .map((row) => row.value as string)
      .sort();

  return { colors: valuesFor("color"), rarities: valuesFor("rarity"), types: valuesFor("type"), sets: sets.data };
}

export async function getPrintLabelById(id: string) {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");

  if (!z.uuid().safeParse(id).success) return null;
  const { data, error } = await createPublicClient()
    .from("catalog_prints")
    .select("id, name, code, variant_label")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Failed to load card");
  return data?.id && data.name && data.code ? { id: data.id, label: cardLabel(data.name, data.code, data.variant_label) } : null;
}

export async function getCardBySlug(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");

  const supabase = createPublicClient();
  const { data, error } = await supabase.from("catalog_prints").select("*").eq("slug", slug).maybeSingle();
  if (error) throw new Error("Failed to load card");
  if (!data?.id || !data.code || !data.name || !data.slug) return null;

  const setIds = data.set_ids ?? [];
  const sets = setIds.length
    ? await supabase.from("card_sets").select("id, name").in("id", setIds).order("name")
    : { data: [], error: null };
  if (sets.error) throw new Error("Failed to load card sets");

  return {
    id: data.id,
    code: data.code,
    name: data.name,
    slug: data.slug,
    variant_label: data.variant_label,
    isDefault: data.is_default ?? false,
    card_type: data.card_type,
    color: data.color,
    color2: data.color2,
    rarity: data.rarity,
    level: data.level,
    play_cost: data.play_cost,
    evolution_cost: data.evolution_cost,
    dp: data.dp,
    attribute: data.attribute,
    form: data.form,
    stage: data.stage,
    digi_types: data.digi_types ?? [],
    main_effect: data.main_effect,
    source_effect: data.source_effect,
    imageUrl: cardImageUrl(data.image_path),
    sets: sets.data,
  };
}

// Every print that shares a card number (default first), for the version picker.
export async function getCardVersions(code: string) {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");

  const { data, error } = await createPublicClient()
    .from("catalog_prints")
    .select("id, slug, is_default, variant_label, image_path")
    .eq("code", code)
    .order("is_default", { ascending: false })
    .order("slug", { ascending: true });
  if (error) throw new Error("Failed to load card versions");

  return data.map((row) => ({
    id: row.id!,
    slug: row.slug!,
    isBase: row.is_default ?? false,
    label: row.variant_label,
    imageUrl: cardImageUrl(row.image_path),
  }));
}

export async function lookupCards(term: string) {
  "use cache";
  cacheLife("hours");
  cacheTag("catalog");

  const q = sanitizeSearchTerm(term);
  if (q.length < 2) return [];

  const { data, error } = await createPublicClient()
    .from("catalog_prints")
    .select("id, code, slug, name, rarity, variant_label, image_path")
    .or(`name.ilike.%${q}%,code.ilike.%${q}%,variant_label.ilike.%${q}%`)
    .order("code")
    .order("is_default", { ascending: false })
    .order("slug")
    .limit(12);
  if (error) throw new Error("Failed to look up cards");

  return data.map((row) => ({
    id: row.id!,
    code: row.code!,
    slug: row.slug!,
    name: row.name!,
    rarity: row.rarity,
    variantLabel: row.variant_label,
    imageUrl: cardImageUrl(row.image_path),
  }));
}
