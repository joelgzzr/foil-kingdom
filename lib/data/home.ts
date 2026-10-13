import "server-only";

import { cacheLife, cacheTag } from "next/cache";

import { cardImageUrl } from "@/lib/data/catalog";
import { createPublicClient } from "@/lib/supabase/public";

const HERO_COLUMNS = "id, slug, code, name, image_path";

// Listed cards first so the hero reflects the marketplace; secret rares fill the rest.
export async function getHeroCards(limit = 5) {
  "use cache";
  cacheLife("minutes");
  cacheTag("catalog", "listings");

  const supabase = createPublicClient();
  const listed = await supabase
    .from("catalog_prints")
    .select(HERO_COLUMNS)
    .eq("is_listed", true)
    .not("image_path", "is", null)
    .limit(limit);
  if (listed.error) throw new Error("Failed to load hero cards");

  const rows = listed.data;
  if (rows.length < limit) {
    const filler = await supabase
      .from("catalog_prints")
      .select(HERO_COLUMNS)
      .eq("is_default", true)
      .eq("rarity", "SEC")
      .not("image_path", "is", null)
      .order("code", { ascending: false })
      .limit(limit);
    if (filler.error) throw new Error("Failed to load hero cards");
    const seen = new Set(rows.map((row) => row.id));
    for (const row of filler.data) {
      if (rows.length >= limit) break;
      if (!seen.has(row.id)) rows.push(row);
    }
  }

  return rows.flatMap((row) => {
    const imageUrl = cardImageUrl(row.image_path);
    return imageUrl && row.id && row.slug && row.name && row.code
      ? [{ id: row.id, slug: row.slug, name: row.name, code: row.code, imageUrl }]
      : [];
  });
}
