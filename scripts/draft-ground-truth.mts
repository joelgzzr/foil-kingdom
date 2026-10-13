// Usage: SCAN_VISION_MODEL=<model> node --env-file=.env.local scripts/draft-ground-truth.mts [--dir=scan-fixtures]
//
// Drafts scan-fixtures/ground-truth.json from Gemini's code reads and writes review.html (photo next to the catalog
// card of every code). The draft is NOT ground truth until a person has checked it against the photos.
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

import { visionProviders } from "../lib/scan/vision.ts";
import type { DetectedCard } from "../lib/scan/types.ts";
import type { Database } from "../lib/supabase/database.types";

const dir = process.argv.find((a) => a.startsWith("--dir="))?.split("=")[1] ?? "scan-fixtures";
const cachePath = path.join(dir, ".draft-detections.json");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabase = createClient<Database>(url, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const cache: Record<string, DetectedCard[]> = await readFile(cachePath, "utf8").then(JSON.parse, () => ({}));
const files = (await readdir(dir)).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();

for (const file of files) {
  if (cache[file]) continue;
  const page = await sharp(path.join(dir, file)).rotate().resize(2048, 2048, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
  try {
    cache[file] = await visionProviders.gemini.detectCards({ bytes: new Uint8Array(page), mimeType: "image/jpeg" });
    console.log(`${file.slice(0, 8)} ${cache[file].length} cards`);
  } catch (error) {
    console.log(`${file.slice(0, 8)} FAILED ${error}`);
  }
  await writeFile(cachePath, JSON.stringify(cache));
}

// Reading order: rows top to bottom, then left to right.
const ordered = (cards: DetectedCard[]) =>
  [...cards].sort((a, b) => Math.round(a.box.y * 4) - Math.round(b.box.y * 4) || a.box.x - b.box.x);

const allCodes = [...new Set(Object.values(cache).flat().map((c) => c.code).filter((c): c is string => !!c))];
const { data: prints, error } = await supabase.from("catalog_prints").select("code, name, image_path, is_default").in("code", allCodes);
if (error) throw error;
const known = new Map<string, { name: string; image: string | null }>();
for (const p of prints ?? []) {
  if (p.code && (p.is_default || !known.has(p.code))) known.set(p.code, { name: p.name ?? "", image: p.image_path });
}

const truth: Record<string, string[]> = {};
let html = `<meta charset="utf-8"><style>body{font:14px system-ui;margin:24px}section{display:flex;gap:16px;margin-bottom:32px;border-bottom:1px solid #ccc;padding-bottom:24px}
.photo{width:420px;flex:none}.cards{display:flex;flex-wrap:wrap;gap:8px;align-content:flex-start}.c{width:120px;font-size:11px}.c img{width:120px;display:block}.bad{color:#c00;font-weight:bold}</style>`;
let unknown = 0;
for (const file of files) {
  if (!cache[file]) continue;
  const cards = ordered(cache[file]);
  truth[file] = cards.map((c) => c.code ?? "?");
  html += `<section><div class="photo"><b>${file.slice(0, 8)}</b> (${cards.length} cards)<img src="${file}" width="420"></div><div class="cards">`;
  for (const [i, card] of cards.entries()) {
    const match = card.code ? known.get(card.code) : undefined;
    if (!match) unknown++;
    html += `<div class="c"><div class="${match ? "" : "bad"}">${i + 1}. ${escapeHtml(card.code ?? "?")}</div>${
      match?.image ? `<img src="${url}/storage/v1/object/public/card-images/${match.image}">` : ""
    }<div>${escapeHtml(match?.name ?? card.name ?? "not in catalog")}</div></div>`;
  }
  html += "</div></section>";
}
await writeFile(path.join(dir, "review.html"), html);
await writeFile(path.join(dir, "ground-truth.json"), JSON.stringify(truth, null, 2) + "\n");
console.log(`${Object.keys(truth).length}/${files.length} pages drafted, ${unknown} cards with unknown code ("?" or not in catalog)`);
