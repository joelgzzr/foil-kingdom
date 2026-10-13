import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../supabase/database.types";
import { codeTail, type CatalogCard, type ReadCard } from "./matching.ts";
import type { DetectedCard } from "./types.ts";

// No server-only import: scripts/scan-benchmark.mts shares this with the app so it scores the real lookup.
const NAME_POOL_LIMIT = 40;
const CODE_PATTERN = /^[A-Z0-9]{1,6}-\d{1,3}$/;

// Strips characters that carry meaning in PostgREST filters (commas, parentheses, wildcards).
const sanitizeName = (name: string) => name.replace(/[^\p{L}\p{N}\s\-'.]/gu, " ").trim().slice(0, 60);

// What the vision model read, cleaned so it is safe to use in catalog queries. Unusable reads become null.
export function toReads(detected: DetectedCard[]): ReadCard[] {
  return detected.map((card) => {
    const name = card.name ? sanitizeName(card.name) : "";
    return { code: card.code && CODE_PATTERN.test(card.code) ? card.code : null, name: name.length >= 2 ? name : null };
  });
}

// One pool of catalog cards for a whole page: the read codes, cards sharing their number, and same-name cards.
export async function fetchCardPool(client: SupabaseClient<Database>, reads: ReadCard[]): Promise<CatalogCard[]> {
  const codes = [...new Set(reads.flatMap((read) => (read.code ? [read.code] : [])))];
  const tails = [...new Set(codes.flatMap((code) => codeTail(code) ?? []))];
  const names = [...new Set(reads.flatMap((read) => (read.name ? [read.name] : [])))];

  const queries = [
    ...(codes.length ? [client.from("cards").select("code, name").in("code", codes)] : []),
    ...(tails.length
      ? [client.from("cards").select("code, name").or(tails.map((tail) => `code.like.%-${tail}`).join(",")).limit(500)]
      : []),
    ...names.map((name) => client.from("cards").select("code, name").ilike("name", `%${name}%`).limit(NAME_POOL_LIMIT)),
  ];

  const pool = new Map<string, CatalogCard>();
  for (const { data, error } of await Promise.all(queries)) {
    if (error) throw error;
    for (const row of data ?? []) pool.set(row.code, { code: row.code, name: row.name });
  }
  return [...pool.values()];
}
