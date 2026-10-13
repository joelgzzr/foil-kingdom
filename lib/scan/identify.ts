import "server-only";

import { cardImageUrl } from "@/lib/data/catalog";
import { createAdminClient } from "@/lib/supabase/admin";

import { rankCandidates } from "./matching.ts";
import { fetchCardPool, toReads } from "./pool.ts";
import type { DetectedCard, IdentifyResult, ScanPrintOption } from "./types.ts";

const MAX_OPTIONS = 40;

// Turns what the vision model read into catalog cards and prints. Every id comes from the catalog; the model's
// output only decides which cards to look at. The seller confirms each card, so a wrong guess costs one tap.
export async function identifyCards(detected: DetectedCard[]): Promise<IdentifyResult[]> {
  if (detected.length === 0) return [];
  const admin = createAdminClient();

  const reads = toReads(detected);
  const cardPool = await fetchCardPool(admin, reads);

  const ranked = reads.map((read) => rankCandidates(read, cardPool));

  // Every print of every candidate card, so the seller can confirm the art.
  const candidateCodes = [...new Set(ranked.flatMap((entry) => entry.cards.map((card) => card.code)))];
  const { data: printRows, error: printError } = candidateCodes.length
    ? await admin
        .from("catalog_prints")
        .select("id, slug, code, name, variant_label, is_default, image_path")
        .in("code", candidateCodes)
    : { data: [], error: null };
  if (printError) throw printError;

  const printsByCode = new Map<string, NonNullable<typeof printRows>>();
  for (const row of printRows ?? []) {
    if (row.id && row.code) printsByCode.set(row.code, [...(printsByCode.get(row.code) ?? []), row]);
  }
  // Base print first, then the rest in a stable order.
  for (const rows of printsByCode.values()) {
    rows.sort((a, b) => Number(b.is_default ?? false) - Number(a.is_default ?? false) || (a.slug ?? "").localeCompare(b.slug ?? ""));
  }

  const printIds = (printRows ?? []).flatMap((row) => (row.id ? [row.id] : []));
  const { data: prices, error: priceError } = printIds.length
    ? await admin.from("print_prices").select("print_id, sub_type, market_usd_cents").in("print_id", printIds)
    : { data: [], error: null };
  if (priceError) throw priceError;
  const priceMap = new Map<string, ScanPrintOption["marketUsdCents"]>();
  for (const price of prices ?? []) {
    const entry = priceMap.get(price.print_id) ?? { normal: null, foil: null };
    entry[price.sub_type as "normal" | "foil"] = price.market_usd_cents;
    priceMap.set(price.print_id, entry);
  }

  return ranked.map(({ status, cards }, index) => {
    const options: ScanPrintOption[] = [];
    for (const card of cards) {
      for (const print of printsByCode.get(card.code) ?? []) {
        if (!print.id || !print.slug || !print.code || !print.name) continue;
        options.push({
          printId: print.id,
          slug: print.slug,
          code: print.code,
          name: print.name,
          variantLabel: print.variant_label,
          isDefault: print.is_default ?? false,
          imageUrl: cardImageUrl(print.image_path),
          marketUsdCents: priceMap.get(print.id) ?? { normal: null, foil: null },
        });
      }
    }
    // Preselect the base print of the best card; the seller picks the art they hold.
    const chosen = options.find((option) => option.code === cards[0]?.code);
    return { index, status, chosenPrintId: chosen?.printId ?? null, options: options.slice(0, MAX_OPTIONS) };
  });
}
