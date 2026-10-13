import type { Finish, ScanPrintOption } from "./types.ts";

// Suggested price per copy in whole pesos: TCGplayer market (USD) x exchange rate x the seller's percentage.
export function suggestedPesos(
  option: Pick<ScanPrintOption, "marketUsdCents"> | undefined,
  finish: Finish,
  usdMxnRate: number,
  percent: number,
): number | null {
  if (!option) return null;
  const { normal, foil } = option.marketUsdCents;
  const usdCents = finish === "foil" ? (foil ?? normal) : (normal ?? foil);
  if (usdCents === null || usdCents === undefined) return null;
  return Math.max(1, Math.ceil(((usdCents / 100) * usdMxnRate * percent) / 100));
}

export function marketPesos(option: ScanPrintOption | undefined, finish: Finish, usdMxnRate: number) {
  return suggestedPesos(option, finish, usdMxnRate, 100);
}
