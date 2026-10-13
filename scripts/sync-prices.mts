// Usage: node --env-file=.env.local scripts/sync-prices.mts [--dry-run]
//
// Reference prices for the binder scanner's price suggestions: TCGCSV (TCGplayer) USD prices per print.
// Only prints with a tcgplayer_product_id get a price. market falls back to mid when TCGplayer has no market price.
import { createClient } from "@supabase/supabase-js";

import type { Database } from "../lib/supabase/database.types";

const GROUPS_URL = "https://tcgcsv.com/tcgplayer/63/groups";
const pricesUrl = (groupId: number) => `https://tcgcsv.com/tcgplayer/63/${groupId}/prices`;

const dryRun = process.argv.includes("--dry-run");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !secretKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required");

const supabase = createClient<Database>(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });

type PriceRow = {
  productId: number;
  lowPrice: number | null;
  midPrice: number | null;
  marketPrice: number | null;
  subTypeName: string;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const chunk = <T,>(items: T[], size: number) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));
const cents = (usd: number | null | undefined) => (typeof usd === "number" && usd >= 0 ? Math.round(usd * 100) : null);

async function getJson<T>(target: string, attempts = 4): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(target, { headers: { "User-Agent": "FoilKingdom-PriceSync/1.0" } });
    if (response.ok) return (await response.json()) as T;
    if (attempt >= attempts || (response.status < 500 && response.status !== 429)) {
      throw new Error(`${target} -> ${response.status}`);
    }
    await sleep(attempt * 2000);
  }
}

async function main() {
  const printIdByProduct = new Map<number, string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("card_prints")
      .select("id, tcgplayer_product_id")
      .not("tcgplayer_product_id", "is", null)
      .range(from, from + 999);
    if (error) throw error;
    for (const row of data) printIdByProduct.set(row.tcgplayer_product_id!, row.id);
    if (data.length < 1000) break;
  }
  console.log(`${printIdByProduct.size} prints with a TCGplayer product`);

  const groups = await getJson<{ results: { groupId: number }[] }>(GROUPS_URL);
  const rows = new Map<string, Database["public"]["Tables"]["print_prices"]["Insert"]>();
  let failedGroups = 0;
  for (const { groupId } of groups.results) {
    try {
      const { results } = await getJson<{ results: PriceRow[] }>(pricesUrl(groupId));
      for (const price of results) {
        const printId = printIdByProduct.get(price.productId);
        const subType = price.subTypeName === "Foil" ? "foil" : price.subTypeName === "Normal" ? "normal" : null;
        if (!printId || !subType) continue;
        const market = cents(price.marketPrice) ?? cents(price.midPrice);
        const low = cents(price.lowPrice);
        if (market === null && low === null) continue;
        rows.set(`${printId}:${subType}`, {
          print_id: printId,
          sub_type: subType,
          market_usd_cents: market,
          low_usd_cents: low,
          updated_at: new Date().toISOString(),
        });
      }
    } catch (error) {
      failedGroups++;
      console.warn(`group ${groupId} failed: ${String(error)}`);
    }
    await sleep(150);
  }

  console.log(`${rows.size} prices (${failedGroups} failed groups)`);
  // A broken source must not wipe good prices: refuse to write when much of it failed.
  if (failedGroups > groups.results.length * 0.1) throw new Error("Too many failed groups; aborting");
  if (dryRun) return;

  for (const batch of chunk([...rows.values()], 500)) {
    const { error } = await supabase.from("print_prices").upsert(batch, { onConflict: "print_id,sub_type" });
    if (error) throw error;
  }
  console.log("Done.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
