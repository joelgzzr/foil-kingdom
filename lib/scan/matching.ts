import type { MatchStatus } from "./types.ts";

export type CatalogCard = { code: string; name: string };
export type ReadCard = { code: string | null; name: string | null };

export const MAX_CANDIDATE_CARDS = 6;

const normalizeName = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

// True when the name read from a photo and the catalog name contain one another.
export function namesAgree(read: string, known: string) {
  const a = normalizeName(read);
  const b = normalizeName(known);
  return a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a));
}

// Number of single-character edits between two codes.
export function codeDistance(a: string, b: string) {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = row;
  }
  return previous[b.length];
}

export const codeTail = (code: string) => code.split("-")[1] ?? null;

// Orders the catalog cards a seller is most likely holding, given what the vision model read.
// A misread set digit usually lands on another real card with the same name, so those come right after the read code.
// Pure so scripts/scan-benchmark.mts scores exactly what the app does.
export function rankCandidates(read: ReadCard, pool: CatalogCard[]): { status: MatchStatus; cards: CatalogCard[] } {
  const primary = read.code ? pool.find((card) => card.code === read.code) : undefined;
  const tail = read.code ? codeTail(read.code) : null;
  const sameName = (card: CatalogCard) =>
    (!!read.name && namesAgree(read.name, card.name)) || (!!primary && namesAgree(primary.name, card.name));

  const score = (card: CatalogCard) => {
    if (card === primary) return 0;
    const sameTail = !!tail && codeTail(card.code) === tail;
    const near = !!read.code && sameTail && codeDistance(read.code, card.code) <= 1;
    if (sameName(card) && sameTail) return 1;
    if (near) return 2;
    if (sameName(card)) return 3;
    return null;
  };

  const cards = pool
    .map((card) => ({ card, rank: score(card) }))
    .filter((entry): entry is { card: CatalogCard; rank: number } => entry.rank !== null)
    .sort((a, b) => a.rank - b.rank || a.card.code.localeCompare(b.card.code))
    .slice(0, MAX_CANDIDATE_CARDS)
    .map((entry) => entry.card);

  const matched = !!primary && !!read.name && namesAgree(read.name, primary.name);
  return { status: matched ? "matched" : cards.length > 0 ? "suggested" : "none", cards };
}
