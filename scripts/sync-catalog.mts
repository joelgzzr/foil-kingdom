// Usage: node --env-file=.env.local scripts/sync-catalog.mts [--variants] [--no-images] [--images-limit=N] [--purge-placeholder-images] [--dry-run] [--force] [--variant-image-size=400w]
//
// Staged catalog pipeline:
//   1. fetch  - digimoncard.io (cards, the source of truth for gameplay data) and, with --variants, TCGCSV (prints).
//   2. match  - TCGCSV products are matched to a card by normalized number, then by manual override
//               (catalog_match_overrides). Anything else lands in the unmatched queue, never in the catalog.
//   3. gate   - the run aborts before writing if a source looks broken (see thresholds below); --force skips the gate.
//   4. write  - cards, default prints (slug = code), variant prints, set links and raw source records.
//   5. images - self-hosted per print, recording the origin and a content hash.
// --dry-run runs stages 1-3 and prints the report without writing anything.
import { createHash } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

import type { Database, Json } from "../lib/supabase/database.types";

const API_URL = "https://digimoncard.io/api-public/search?series=Digimon%20Card%20Game";
const IMAGE_BASE = "https://images.digimoncard.io/images/cards";
const TCG_GROUPS_URL = "https://tcgcsv.com/tcgplayer/63/groups";
const tcgProductsUrl = (groupId: number) => `https://tcgcsv.com/tcgplayer/63/${groupId}/products`;
const TCG_IMAGE_BASE = "https://tcgplayer-cdn.tcgplayer.com/product";
const TCG_DELAY_MS = 150;
const BUCKET = "card-images";
const IMAGE_CONCURRENCY = 4;
const IMAGE_DELAY_MS = 150;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const SOURCE_CARDS = "digimoncard.io";
const SOURCE_PRINTS = "tcgcsv";
// SHA-256 of TCGplayer's "Image Coming Soon" JPEG at 200w, 400w and in_1000x1000; the CDN serves it with HTTP 200.
const PLACEHOLDER_SHA256 = new Set([
  "37b47a00fb2d86230884e39f802929cbfec1f3df1a4d812c57198cdd487714b7",
  "1a23cf4f45e328c59ed55480a3276f9ee39ec2f10471efa6b6706068c38176d7",
  "79d0863575b2291933381860e2a2f95d782458a4d36692af7bc99aec9930ae7b",
]);

// Gate thresholds: a broken or partial source must never overwrite a healthy catalog.
const MIN_CARDS_RATIO = 0.9; // fetched cards vs cards already in the DB
const MAX_UNMATCHED_RATIO = 0.01; // unmatched numbered products vs all numbered products

type SourceCard = {
  id: string;
  name: string;
  type: string | null;
  color: string | null;
  color2: string | null;
  rarity: string | null;
  level: number | null;
  play_cost: number | null;
  evolution_cost: number | null;
  dp: number | null;
  attribute: string | null;
  form: string | null;
  stage: string | null;
  digi_type: string | null;
  digi_type2: string | null;
  digi_type3: string | null;
  digi_type4: string | null;
  digi_type5: string | null;
  main_effect: string | null;
  source_effect: string | null;
  set_name: string[] | null;
};

type TcgGroup = { groupId: number; name: string; publishedOn: string };
type TcgProduct = {
  productId: number;
  name: string;
  imageCount: number;
  extendedData?: { name: string; value: string }[];
};
type Override = { code: string | null; ignore: boolean };
type Candidate = {
  code: string;
  productId: number;
  label: string;
  group: string;
  published: string;
  // Set when the product comes from a pre-release / release event group; label always carries it.
  event: string | null;
  // Event product whose own name had no label (same art as the set print, plus a stamp).
  bareEvent: boolean;
  hasImage: boolean;
  number: string;
  method: "code" | "override";
  raw: TcgProduct;
};
type PrintRecord = {
  productId: number;
  number: string | null;
  code: string | null;
  slug: string | null;
  method: "code" | "override" | "unmatched" | "ignored";
  raw: TcgProduct;
};
type PrintsResult = {
  defaults: Map<string, Candidate>;
  variants: { candidate: Candidate; label: string; slug: string }[];
  records: PrintRecord[];
  numbered: number;
  unmatched: PrintRecord[];
  failedGroups: number;
  rarityConflicts: string[];
};

const args = process.argv.slice(2);
const skipImages = args.includes("--no-images");
const purgePlaceholders = args.includes("--purge-placeholder-images");
const withVariants = args.includes("--variants");
const dryRun = args.includes("--dry-run");
const force = args.includes("--force");
const imagesLimit = Number(args.find((a) => a.startsWith("--images-limit="))?.split("=")[1] ?? Infinity);
const variantImageSize = args.find((a) => a.startsWith("--variant-image-size="))?.split("=")[1] ?? "400w";
if (!/^(200w|400w|in_1000x1000)$/.test(variantImageSize)) throw new Error("Unsupported --variant-image-size");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !secretKey) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required");

const supabase = createClient<Database>(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : null);
const json = (value: unknown) => value as Json;
const chunk = <T,>(items: T[], size: number) =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));

async function fetchWithRetry(target: string, attempts = 4): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    const response = await fetch(target, { headers: { "User-Agent": "FoilKingdom-CatalogSync/1.0" } });
    if (response.ok || (response.status < 500 && response.status !== 429) || attempt >= attempts) return response;
    // A 429 can mean a one-hour block; back off hard instead of hammering the API.
    await sleep(attempt * 2000);
  }
}

function isWebp(bytes: Uint8Array) {
  return (
    bytes.length > 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  );
}

type ImageCandidate = { url: string; source: string };

async function downloadImage(candidates: ImageCandidate[]) {
  for (const candidate of candidates) {
    const response = await fetchWithRetry(candidate.url);
    if (!response.ok) continue;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) continue;
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    if (PLACEHOLDER_SHA256.has(sha256)) continue;
    // digimoncard.io serves WebP under a .jpg name, so sniff the real type.
    return {
      bytes,
      contentType: isWebp(bytes) ? "image/webp" : "image/jpeg",
      source: candidate.source,
      sha256,
    };
  }
  return null;
}

const tcgImageUrl = (productId: number) => `${TCG_IMAGE_BASE}/${productId}_${variantImageSize}.jpg`;

// Normalizes TCGplayer numbers ("BT23-047SR", "P - 214 P", "Ex6-053 U") to a catalog code candidate.
function codeFromNumber(value: string) {
  const match = value.trim().toUpperCase().match(/^([A-Z0-9]+)\s*-\s*(\d+)/);
  return match ? `${match[1]}-${match[2]}` : null;
}

function raritySuffix(value: string) {
  return value.trim().toUpperCase().replace(/^[A-Z0-9]+\s*-\s*\d+/, "").trim();
}

const nameParts = (value: string) =>
  [...value.matchAll(/\(([^()]*)\)|\[([^[\]]*)\]/g)].map((m) => (m[1] ?? m[2]).trim()).filter(Boolean);

// "Agumon (Alternate Art) [Foil]" -> "Alternate Art · Foil"; parts of the card's own name ("Tokomon (X Antibody)") are not labels.
function labelFromName(name: string, cardName: string) {
  const own = nameParts(cardName);
  const parts = nameParts(name).filter((part) => {
    const index = own.indexOf(part);
    if (index === -1) return true;
    own.splice(index, 1);
    return false;
  });
  return [...new Set(parts)].join(" · ");
}

const EVENT_GROUPS: [RegExp, string][] = [
  [/pre-release cards$/i, "Pre-Release"],
  [/release event cards$/i, "Release Event"],
  [/celebration event cards$/i, "Celebration Event"],
];

const eventOfGroup = (groupName: string) => EVENT_GROUPS.find(([pattern]) => pattern.test(groupName.trim()))?.[1] ?? null;

async function fetchTcgJson<T>(target: string): Promise<T[] | null> {
  const response = await fetchWithRetry(target);
  if (!response.ok) {
    console.warn(`  TCGCSV ${response.status} for ${target}`);
    return null;
  }
  const body = (await response.json()) as { results?: T[] };
  return body.results ?? [];
}

async function fetchSource() {
  console.log("Fetching catalog…");
  const response = await fetchWithRetry(API_URL);
  if (!response.ok) throw new Error(`Catalog request failed: ${response.status}`);
  const source = (await response.json()) as SourceCard[];
  if (!Array.isArray(source) || source.length === 0) throw new Error("Catalog response was empty");
  console.log(`  ${source.length} cards`);
  return source;
}

async function loadOverrides() {
  const { data, error } = await supabase
    .from("catalog_match_overrides")
    .select("external_id, code, ignore")
    .eq("source", SOURCE_PRINTS);
  if (error) throw error;
  return new Map<string, Override>(data.map((row) => [row.external_id, { code: row.code, ignore: row.ignore }]));
}

// Stage 1+2 for prints. The earliest plain print of each code is that card's default print (slug = code);
// every other print becomes a variant.
async function fetchPrints(
  rarityByCode: Map<string, string | null>,
  nameByCode: Map<string, string>,
  overrides: Map<string, Override>,
): Promise<PrintsResult> {
  const groups = await fetchTcgJson<TcgGroup>(TCG_GROUPS_URL);
  if (!groups?.length) throw new Error("TCGCSV returned no groups");
  const codeByUpper = new Map([...rarityByCode.keys()].map((code) => [code.toUpperCase(), code]));
  const knownRarities = new Set([...rarityByCode.values()].filter((value): value is string => Boolean(value)));

  const candidates: Candidate[] = [];
  const records: PrintRecord[] = [];
  let numbered = 0;
  let failedGroups = 0;

  for (const group of groups) {
    const products = await fetchTcgJson<TcgProduct>(tcgProductsUrl(group.groupId));
    await sleep(TCG_DELAY_MS);
    if (!products) {
      failedGroups++;
      continue;
    }
    for (const product of products) {
      const number = product.extendedData?.find((entry) => entry.name === "Number")?.value;
      if (!number) continue;
      numbered++;

      const override = overrides.get(String(product.productId));
      if (override?.ignore) {
        records.push({ productId: product.productId, number, code: null, slug: null, method: "ignored", raw: product });
        continue;
      }
      const normalized = codeFromNumber(number);
      const code = override?.code ?? (normalized ? codeByUpper.get(normalized) : undefined);
      if (!code || !rarityByCode.has(code)) {
        records.push({ productId: product.productId, number, code: null, slug: null, method: "unmatched", raw: product });
        continue;
      }
      const ownLabel = labelFromName(product.name, nameByCode.get(code) ?? "");
      const event = eventOfGroup(group.name);
      const label =
        event && !ownLabel.toLowerCase().includes(event.toLowerCase()) ? [event, ownLabel].filter(Boolean).join(" · ") : ownLabel;
      candidates.push({
        code,
        productId: product.productId,
        label,
        group: group.name,
        published: group.publishedOn,
        event,
        bareEvent: Boolean(event) && !ownLabel,
        hasImage: product.imageCount > 0,
        number,
        method: override?.code ? "override" : "code",
        raw: product,
      });
    }
  }

  const byCode = new Map<string, Candidate[]>();
  for (const candidate of candidates) byCode.set(candidate.code, [...(byCode.get(candidate.code) ?? []), candidate]);

  const defaults = new Map<string, Candidate>();
  const variants: PrintsResult["variants"] = [];
  const rarityConflicts: string[] = [];
  for (const [code, list] of byCode) {
    const earliest = (a: Candidate, b: Candidate) => a.published.localeCompare(b.published) || a.productId - b.productId;
    // Event stamps never take the default slot while a regular set print exists; event-only codes (promos) still get one.
    const baseEquivalent =
      list.filter((candidate) => !candidate.label).sort(earliest)[0] ??
      list.filter((candidate) => candidate.bareEvent).sort(earliest)[0];
    if (baseEquivalent) {
      defaults.set(code, baseEquivalent);
      records.push({
        productId: baseEquivalent.productId,
        number: baseEquivalent.number,
        code,
        slug: code,
        method: baseEquivalent.method,
        raw: baseEquivalent.raw,
      });
      const suffix = raritySuffix(baseEquivalent.number);
      if (suffix && knownRarities.has(suffix) && rarityByCode.get(code) !== suffix) {
        rarityConflicts.push(`${code}: digimoncard.io ${rarityByCode.get(code) ?? "-"} vs TCGplayer ${suffix}`);
      }
    }

    const extra = list.filter((candidate) => candidate !== baseEquivalent);
    const labelOf = (candidate: Candidate) => candidate.label || candidate.group;
    const labelCounts = new Map<string, number>();
    for (const candidate of extra) labelCounts.set(labelOf(candidate), (labelCounts.get(labelOf(candidate)) ?? 0) + 1);
    const seen = new Map<string, number>();
    const ordered = [...extra].sort((a, b) => a.productId - b.productId);
    for (const candidate of ordered) {
      const base = labelOf(candidate);
      const labelled =
        (labelCounts.get(base) ?? 0) > 1 && base !== candidate.group ? `${base} · ${candidate.group}` : base;
      const count = (seen.get(labelled) ?? 0) + 1;
      seen.set(labelled, count);
      const slug = `${code}-${candidate.productId}`;
      variants.push({ candidate, label: count > 1 ? `${labelled} #${count}` : labelled, slug });
      records.push({
        productId: candidate.productId,
        number: candidate.number,
        code,
        slug,
        method: candidate.method,
        raw: candidate.raw,
      });
    }
  }

  return {
    defaults,
    variants,
    records,
    numbered,
    unmatched: records.filter((record) => record.method === "unmatched"),
    failedGroups,
    rarityConflicts,
  };
}

type ProductMove = { id: string; slug: string; isDefault: boolean; targetSlug: string };

// tcgplayer_product_id is unique: a product that now belongs to another print must be freed before the upserts.
async function planProductMoves(gameId: string, prints: PrintsResult) {
  const slugByProduct = new Map<number, string>();
  for (const [code, candidate] of prints.defaults) slugByProduct.set(candidate.productId, code);
  for (const variant of prints.variants) slugByProduct.set(variant.candidate.productId, variant.slug);

  const moves: ProductMove[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("card_prints")
      .select("id, slug, is_default, tcgplayer_product_id")
      .eq("game_id", gameId)
      .not("tcgplayer_product_id", "is", null)
      .order("id")
      .range(from, from + 999);
    if (error) throw error;
    for (const row of data) {
      const targetSlug = slugByProduct.get(row.tcgplayer_product_id!);
      if (targetSlug && targetSlug !== row.slug) {
        moves.push({ id: row.id, slug: row.slug, isDefault: row.is_default, targetSlug });
      }
    }
    if (data.length < 1000) break;
  }
  return moves;
}

// Variants whose product became the default print of their card are duplicates and get merged into it.
const staleVariantsOf = (moves: ProductMove[], prints: PrintsResult) =>
  moves.filter((move) => !move.isDefault && prints.defaults.has(move.targetSlug));

function buildReport(cardCount: number, prints: PrintsResult | null, moves: ProductMove[] = []) {
  if (!prints) return { cards: cardCount };
  return {
    cards: cardCount,
    productIdMoves: moves.length,
    staleVariantsToMerge: staleVariantsOf(moves, prints).length,
    movedSample: moves.slice(0, 20).map((move) => `${move.slug} -> ${move.targetSlug}`),
    defaultsWithProduct: prints.defaults.size,
    variants: prints.variants.length,
    variantsWithoutImage: prints.variants.filter((v) => !v.candidate.hasImage).length,
    eventVariants: prints.variants.filter((v) => v.candidate.event).length,
    eventVariantsWithoutImage: prints.variants.filter((v) => v.candidate.event && !v.candidate.hasImage).length,
    numberedProducts: prints.numbered,
    ignored: prints.records.filter((record) => record.method === "ignored").length,
    overridden: prints.records.filter((record) => record.method === "override").length,
    unmatched: prints.unmatched.length,
    unmatchedSample: prints.unmatched.slice(0, 50).map((record) => `${record.number} (${record.raw.name})`),
    rarityConflicts: prints.rarityConflicts.length,
    rarityConflictSample: prints.rarityConflicts.slice(0, 50),
    failedGroups: prints.failedGroups,
  };
}

// Stage 3. Throws unless --force.
async function gate(gameId: string, sourceCount: number, prints: PrintsResult | null) {
  const problems: string[] = [];
  const { count, error } = await supabase
    .from("cards")
    .select("id", { count: "exact", head: true })
    .eq("game_id", gameId);
  if (error) throw error;
  if (count && sourceCount < count * MIN_CARDS_RATIO) {
    problems.push(`digimoncard.io returned ${sourceCount} cards but the catalog has ${count}`);
  }
  if (prints) {
    if (prints.failedGroups > 0) problems.push(`${prints.failedGroups} TCGCSV groups failed to load`);
    if (prints.numbered > 0 && prints.unmatched.length / prints.numbered > MAX_UNMATCHED_RATIO) {
      problems.push(`${prints.unmatched.length}/${prints.numbered} TCGCSV products are unmatched`);
    }
  }
  if (!problems.length) return;
  for (const problem of problems) console.error(`  gate: ${problem}`);
  if (!force) throw new Error("Sync gate failed; fix the source or resolve unmatched records, or pass --force");
  console.warn("  --force set: continuing despite gate failures");
}

function printReport(report: Record<string, unknown>) {
  console.log("Report:");
  for (const [key, value] of Object.entries(report)) {
    if (Array.isArray(value)) {
      if (value.length) console.log(`  ${key}:\n    ${value.slice(0, 20).join("\n    ")}`);
    } else {
      console.log(`  ${key}: ${value}`);
    }
  }
}

type PendingPrint = {
  id: string;
  slug: string;
  is_default: boolean;
  tcgplayer_product_id: number | null;
  cards: { code: string };
};

async function loadPendingImages(gameId: string) {
  const pending: PendingPrint[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("card_prints")
      .select("id, slug, is_default, tcgplayer_product_id, cards!inner(code)")
      .eq("game_id", gameId)
      .is("image_path", null)
      .order("id")
      .range(from, from + 999);
    if (error) throw error;
    pending.push(...data);
    if (data.length < 1000) break;
  }
  return pending;
}

async function purgePlaceholderImages(gameId: string) {
  const { data, error } = await supabase
    .from("card_prints")
    .select("id, image_path")
    .eq("game_id", gameId)
    .in("image_sha256", [...PLACEHOLDER_SHA256]);
  if (error) throw error;
  if (!data.length) return;
  const paths = data.flatMap((row) => (row.image_path ? [row.image_path] : []));
  const removed = await supabase.storage.from(BUCKET).remove(paths);
  if (removed.error) throw removed.error;
  const { error: updateError } = await supabase
    .from("card_prints")
    .update({ image_path: null, image_source: null, image_sha256: null })
    .in("id", data.map((row) => row.id));
  if (updateError) throw updateError;
  console.log(`  purged ${data.length} placeholder images`);
}

async function syncImages(gameId: string) {
  if (purgePlaceholders) await purgePlaceholderImages(gameId);
  const pending = (await loadPendingImages(gameId)).slice(0, Number.isFinite(imagesLimit) ? imagesLimit : undefined);
  let downloaded = 0;
  const missing: string[] = [];

  for (const batch of chunk(pending, IMAGE_CONCURRENCY)) {
    await Promise.all(
      batch.map(async (print) => {
        const code = encodeURIComponent(print.cards.code);
        const tcg: ImageCandidate[] = print.tcgplayer_product_id
          ? [{ url: tcgImageUrl(print.tcgplayer_product_id), source: SOURCE_PRINTS }]
          : [];
        const candidates: ImageCandidate[] = print.is_default
          ? [
              { url: `${IMAGE_BASE}/${code}.jpg`, source: SOURCE_CARDS },
              { url: `${IMAGE_BASE}/${code}.webp`, source: SOURCE_CARDS },
              ...tcg,
            ]
          : tcg;
        const image = await downloadImage(candidates);
        if (!image) {
          missing.push(print.slug);
          return;
        }
        const extension = image.contentType === "image/webp" ? "webp" : "jpg";
        const path = print.is_default ? `digimon/${print.cards.code}.${extension}` : `digimon/variants/${print.slug}.${extension}`;
        const upload = await supabase.storage.from(BUCKET).upload(path, image.bytes, {
          contentType: image.contentType,
          upsert: true,
          cacheControl: "31536000",
        });
        if (upload.error) {
          console.warn(`  upload failed for ${print.slug}: ${upload.error.message}`);
          missing.push(print.slug);
          return;
        }
        const { error } = await supabase
          .from("card_prints")
          .update({ image_path: path, image_source: image.source, image_sha256: image.sha256 })
          .eq("id", print.id);
        if (error) throw error;
        downloaded++;
      }),
    );
    if (downloaded % 100 < IMAGE_CONCURRENCY) console.log(`  images: ${downloaded}/${pending.length}`);
    await sleep(IMAGE_DELAY_MS);
  }

  if (missing.length) {
    console.warn(`  ${missing.length} prints still have no image: ${missing.slice(0, 40).join(", ")}${missing.length > 40 ? ", …" : ""}`);
  }
  return downloaded;
}

async function upsertInChunks<T extends object>(
  table: "card_set_cards" | "catalog_source_records",
  rows: T[],
  onConflict: string,
  size: number,
) {
  for (const batch of chunk(rows, size)) {
    const { error } = await supabase.from(table).upsert(batch as never, { onConflict });
    if (error) throw error;
  }
}

async function main() {
  const { data: game, error: gameError } = await supabase.from("games").select("id").eq("slug", "digimon").single();
  if (gameError) throw gameError;

  const run = dryRun
    ? null
    : (await supabase.from("catalog_sync_runs").insert({ game_id: game.id }).select("id").single().then(({ data, error }) => {
        if (error) throw error;
        return data;
      }));

  try {
    const source = await fetchSource();
    const rarityByCode = new Map(source.map((card) => [card.id, card.rarity ? card.rarity.toUpperCase() : null]));
    const nameByCode = new Map(source.map((card) => [card.id, card.name]));

    let prints: PrintsResult | null = null;
    let moves: ProductMove[] = [];
    if (withVariants) {
      console.log("Fetching prints…");
      prints = await fetchPrints(rarityByCode, nameByCode, await loadOverrides());
      moves = await planProductMoves(game.id, prints);
    }

    const report = buildReport(source.length, prints, moves);
    printReport(report);
    await gate(game.id, source.length, prints);
    if (dryRun) {
      console.log("Dry run: nothing written.");
      return;
    }

    const seenAt = new Date().toISOString();
    const setNames = [...new Set(source.flatMap((card) => card.set_name ?? []))];
    for (const names of chunk(setNames, 500)) {
      const { error } = await supabase
        .from("card_sets")
        .upsert(names.map((name) => ({ game_id: game.id, name })), { onConflict: "game_id,name" });
      if (error) throw error;
    }
    const { data: sets, error: setsError } = await supabase.from("card_sets").select("id, name").eq("game_id", game.id);
    if (setsError) throw setsError;
    const setIdByName = new Map(sets.map((set) => [set.name, set.id]));

    const rows = source.map((card) => ({
      game_id: game.id,
      code: card.id,
      name: card.name,
      card_type: card.type,
      color: card.color,
      color2: card.color2,
      rarity: card.rarity ? card.rarity.toUpperCase() : null,
      level: num(card.level),
      play_cost: num(card.play_cost),
      evolution_cost: num(card.evolution_cost),
      dp: num(card.dp),
      attribute: card.attribute,
      form: card.form,
      stage: card.stage,
      digi_types: [card.digi_type, card.digi_type2, card.digi_type3, card.digi_type4, card.digi_type5].filter(
        (value): value is string => Boolean(value),
      ),
      main_effect: card.main_effect || null,
      source_effect: card.source_effect || null,
      synced_at: seenAt,
    }));

    const cardIdByCode = new Map<string, string>();
    for (const batch of chunk(rows, 500)) {
      const { data, error } = await supabase.from("cards").upsert(batch, { onConflict: "game_id,code" }).select("id, code");
      if (error) throw error;
      for (const card of data) cardIdByCode.set(card.code, card.id);
    }

    const links: { set_id: string; card_id: string }[] = [];
    for (const card of source) {
      const cardId = cardIdByCode.get(card.id);
      if (!cardId) continue;
      for (const name of card.set_name ?? []) {
        const setId = setIdByName.get(name);
        if (setId) links.push({ set_id: setId, card_id: cardId });
      }
    }
    for (const batch of chunk(links, 1000)) {
      const { error } = await supabase
        .from("card_set_cards")
        .upsert(batch, { onConflict: "set_id,card_id", ignoreDuplicates: true });
      if (error) throw error;
    }
    console.log(`  upserted ${rows.length} cards, ${setNames.length} sets, ${links.length} set links`);

    // Default prints. Rows with and without tcgplayer_product_id are upserted separately so a run without
    // --variants never clears a stored product id.
    const defaultRows = source.map((card) => ({
      card_id: cardIdByCode.get(card.id)!,
      game_id: game.id,
      slug: card.id,
      is_default: true,
    }));
    const printIdBySlug = new Map<string, string>();
    const upsertPrints = async (batchRows: Database["public"]["Tables"]["card_prints"]["Insert"][]) => {
      for (const batch of chunk(batchRows, 500)) {
        const { data, error } = await supabase
          .from("card_prints")
          .upsert(batch, { onConflict: "game_id,slug" })
          .select("id, slug");
        if (error) throw error;
        for (const print of data) printIdBySlug.set(print.slug, print.id);
      }
    };
    if (prints) {
      for (const batch of chunk(moves, 200)) {
        const { error } = await supabase
          .from("card_prints")
          .update({ tcgplayer_product_id: null })
          .in(
            "id",
            batch.map((move) => move.id),
          );
        if (error) throw error;
      }
      const withProduct = defaultRows.filter((row) => prints.defaults.has(row.slug));
      const withoutProduct = defaultRows.filter((row) => !prints.defaults.has(row.slug));
      await upsertPrints(withProduct.map((row) => ({ ...row, tcgplayer_product_id: prints.defaults.get(row.slug)!.productId })));
      await upsertPrints(withoutProduct);
    } else {
      await upsertPrints(defaultRows);
    }

    let variantsUpserted = 0;
    if (prints) {
      await upsertPrints(
        prints.variants.map(({ candidate, label, slug }) => ({
          card_id: cardIdByCode.get(candidate.code)!,
          game_id: game.id,
          slug,
          is_default: false,
          variant_label: label,
          tcgplayer_product_id: candidate.productId,
        })),
      );
      variantsUpserted = prints.variants.length;
      console.log(`  upserted ${variantsUpserted} variants`);

      const stale = staleVariantsOf(moves, prints);
      for (const move of stale) {
        const target = printIdBySlug.get(move.targetSlug);
        if (!target) continue;
        const { error } = await supabase.rpc("merge_card_prints", { p_stale: move.id, p_target: target });
        if (error) throw error;
      }
      if (stale.length) console.log(`  merged ${stale.length} duplicate variants into their default print`);
    }

    // Raw source records keep every imported record auditable. first_seen_at is omitted so it is preserved.
    const sourceRecords = [
      ...source.map((card) => ({
        game_id: game.id,
        source: SOURCE_CARDS,
        external_id: card.id,
        kind: "card",
        number: card.id,
        card_id: cardIdByCode.get(card.id) ?? null,
        print_id: null,
        match_method: "code",
        payload: json(card),
        last_seen_at: seenAt,
      })),
      ...(prints?.records ?? []).map((record) => ({
        game_id: game.id,
        source: SOURCE_PRINTS,
        external_id: String(record.productId),
        kind: "print",
        number: record.number,
        card_id: record.code ? (cardIdByCode.get(record.code) ?? null) : null,
        print_id: record.slug ? (printIdBySlug.get(record.slug) ?? null) : null,
        match_method: record.method,
        payload: json(record.raw),
        last_seen_at: seenAt,
      })),
    ];
    await upsertInChunks("catalog_source_records", sourceRecords, "source,external_id", 500);

    let imagesDownloaded = 0;
    if (!skipImages) {
      console.log("Syncing images…");
      imagesDownloaded = await syncImages(game.id);
    }

    await supabase
      .from("catalog_sync_runs")
      .update({
        status: "succeeded",
        finished_at: new Date().toISOString(),
        cards_upserted: rows.length,
        prints_upserted: rows.length + variantsUpserted,
        unmatched_count: prints?.unmatched.length ?? 0,
        images_downloaded: imagesDownloaded,
        report: json(report),
      })
      .eq("id", run!.id);
    console.log(`Done. Images downloaded: ${imagesDownloaded}`);
  } catch (error) {
    if (run) {
      await supabase
        .from("catalog_sync_runs")
        .update({ status: "failed", finished_at: new Date().toISOString(), error: String(error) })
        .eq("id", run.id);
    }
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
