// Usage: node --env-file=.env.local scripts/scan-benchmark.mts [--vision=gemini] [--dir=scan-fixtures]
//
// Benchmark for the binder scanner. Put real binder photos in scan-fixtures/ (gitignored) together with
// scan-fixtures/ground-truth.json:  { "page1.jpg": ["BT1-009", "BT1-009", "ST1-02"], ... }  (card codes on each page,
// order-free, duplicates repeated). The catalog must already be synced.
// Scoring is card-level (code). It reports:
//   matched    cards where the read code and name agree with one catalog card, and how often that card is right;
//   coverage   cards whose true code is among the candidates a seller sees (the number that matters, since the seller
//              confirms every card). Gate: coverage >= 95%.
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

import { rankCandidates } from "../lib/scan/matching.ts";
import { fetchCardPool, toReads } from "../lib/scan/pool.ts";
import type { ScanImage } from "../lib/scan/types.ts";
import { visionProviders } from "../lib/scan/vision.ts";
import type { Database } from "../lib/supabase/database.types";

const args = process.argv.slice(2);
const flag = (name: string, fallback: string) => args.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? fallback;
const dir = flag("dir", "scan-fixtures");
const visionIds = flag("vision", process.env.SCAN_VISION_PROVIDER ?? "gemini").split(",");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !secretKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required");
const supabase = createClient<Database>(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });

const pct = (n: number, d: number) => (d === 0 ? "n/a" : `${((100 * n) / d).toFixed(1)}%`);

async function pageImage(file: string): Promise<ScanImage> {
  const bytes = await sharp(file).rotate().resize(2048, 2048, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
  return { bytes: new Uint8Array(bytes), mimeType: "image/jpeg" };
}

async function main() {
  const truth = JSON.parse(await readFile(path.join(dir, "ground-truth.json"), "utf8")) as Record<string, string[]>;
  const files = (await readdir(dir)).filter((f) => /\.(jpe?g|png|webp)$/i.test(f) && truth[f]);
  if (files.length === 0) throw new Error(`No photos with ground truth in ${dir}/`);
  const report: unknown[] = [];

  for (const visionId of visionIds) {
    const vision = visionProviders[visionId];
    if (!vision) throw new Error(`Unknown vision provider ${visionId}`);

    let truthTotal = 0;
    let detectedTotal = 0;
    let matched = 0;
    let matchedCorrect = 0;
    let covered = 0;
    let totalMs = 0;
    const wrong: string[] = [];
    const missed: string[] = [];

    for (const file of files) {
      const image = await pageImage(path.join(dir, file));
      const started = Date.now();
      const detected = await vision.detectCards(image);
      totalMs += Date.now() - started;

      const reads = toReads(detected);
      const pool = await fetchCardPool(supabase, reads);
      const remaining = new Map<string, number>();
      for (const code of truth[file]) remaining.set(code, (remaining.get(code) ?? 0) + 1);
      truthTotal += truth[file].length;
      detectedTotal += detected.length;

      // The first pass settles the primary card of every detection, so a card is not counted for a neighbour's code.
      const ranked = reads.map((read) => rankCandidates(read, pool));
      ranked.forEach(({ status, cards }, i) => {
        const primary = cards[0]?.code;
        const hit = !!primary && (remaining.get(primary) ?? 0) > 0;
        if (status === "matched") {
          matched++;
          if (hit) matchedCorrect++;
          else wrong.push(`${file}: read ${reads[i].code} "${reads[i].name}"`);
        }
        const code = cards.map((card) => card.code).find((c) => (remaining.get(c) ?? 0) > 0);
        if (code) {
          covered++;
          remaining.set(code, remaining.get(code)! - 1);
        }
      });
      for (const [code, count] of remaining) if (count > 0) missed.push(`${file}: ${code} x${count}`);
    }

    console.log(`\n== Vision: ${visionId} ==`);
    console.log(`pages ${files.length}, truth cards ${truthTotal}, detected ${detectedTotal} (count ratio ${pct(detectedTotal, truthTotal)}), avg ${Math.round(totalMs / files.length)} ms/page`);
    console.log(`matched ${matched} (${pct(matched, truthTotal)} of truth cards), precision ${pct(matchedCorrect, matched)}`);
    console.log(`candidate coverage ${pct(covered, truthTotal)} of truth cards (gate: 95%)`);
    if (wrong.length) console.log(`matched but wrong:\n  ${wrong.join("\n  ")}`);
    if (missed.length) console.log(`true card not offered:\n  ${missed.join("\n  ")}`);
    report.push({ vision: visionId, truthTotal, detectedTotal, matched, matchedCorrect, covered });
  }

  await writeFile(path.join(dir, "report.json"), JSON.stringify(report, null, 2));
  console.log(`\nWrote ${path.join(dir, "report.json")}.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
