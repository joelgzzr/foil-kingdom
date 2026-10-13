import { z } from "zod";

import { toBase64 } from "./image.ts";
import type { DetectedCard, ScanImage, VisionProvider } from "./types.ts";

const DETECT_PROMPT = `You are looking at a photo of a trading card collection (binder pages, a table or a stack) of the Digimon Card Game.
Find EVERY individual card that is at least mostly visible, including cards in sleeves or binder pockets and foil cards with glare.
For each card return:
- box_2d: [ymin, xmin, ymax, xmax] of the whole card, integers from 0 to 1000 relative to the image.
- code: the card number printed on the card (for example "BT1-009", "ST1-02", "EX3-001", "P-001"), or null if it is not legible.
- name: the card name as printed, or null.
- foil: true only if the card clearly has a foil or holographic finish.
Do not invent cards. Empty binder pockets are not cards. Read the code exactly as printed.`;

// The model output is untrusted: validate and clamp it before anything else sees it.
const codeSchema = z
  .string()
  .transform((value) => value.toUpperCase().replace(/\s+/g, ""))
  .pipe(z.string().regex(/^[A-Z]{1,4}\d{0,2}-\d{1,3}$/));

const rawCardSchema = z.object({
  box_2d: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  code: z.string().nullish(),
  name: z.string().max(120).nullish(),
  foil: z.boolean().nullish(),
});

const rawResponseSchema = z.object({ cards: z.array(rawCardSchema).max(60) });

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export function normalizeDetectedCards(raw: unknown): DetectedCard[] {
  const parsed = rawResponseSchema.safeParse(raw);
  if (!parsed.success) return [];
  const cards: DetectedCard[] = [];
  for (const item of parsed.data.cards) {
    const [ymin, xmin, ymax, xmax] = item.box_2d.map((v) => clamp01(v / 1000));
    const width = xmax - xmin;
    const height = ymax - ymin;
    // Drops degenerate boxes (specks, slivers) the model sometimes returns.
    if (width < 0.03 || height < 0.03) continue;
    const code = item.code ? codeSchema.safeParse(item.code) : null;
    cards.push({
      box: { x: xmin, y: ymin, width, height },
      code: code?.success ? code.data : null,
      name: item.name?.trim() || null,
      finish: item.foil ? "foil" : null,
    });
  }
  return cards;
}

// Google Gemini over plain HTTPS. Verify the model and response shape with scripts/scan-benchmark.mts before relying on it.
const geminiVisionProvider: VisionProvider = {
  id: "gemini",
  async detectCards(image: ScanImage) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY is not configured");
    const model = process.env.SCAN_VISION_MODEL ?? "gemini-3.5-flash";

    const request = JSON.stringify({
        contents: [
          {
            parts: [
              { inline_data: { mime_type: image.mimeType, data: toBase64(image.bytes) } },
              { text: DETECT_PROMPT },
            ],
          },
        ],
        generationConfig: {
          temperature: 0,
          // Gemini 3 models think by default (up to ~50 s per page); "low" keeps detection around 6 s.
          thinkingConfig: { thinkingLevel: "low" },
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              cards: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    box_2d: { type: "ARRAY", items: { type: "INTEGER" } },
                    code: { type: "STRING", nullable: true },
                    name: { type: "STRING", nullable: true },
                    foil: { type: "BOOLEAN", nullable: true },
                  },
                  required: ["box_2d"],
                },
              },
            },
            required: ["cards"],
          },
        },
    });

    // 429 / 503 are transient on Gemini (overload, per-minute quota): retry with backoff.
    let response: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: request,
        signal: AbortSignal.timeout(50_000),
      });
      if (response.ok || (response.status !== 429 && response.status !== 503)) break;
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 2_000 * 3 ** attempt));
    }
    if (!response || !response.ok) throw new Error(`Vision provider failed (${response?.status})`);

    const body = (await response.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = body.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return [];
    try {
      return normalizeDetectedCards(JSON.parse(text));
    } catch {
      return [];
    }
  },
};

// Deterministic 3x3 page of well-known cards for local development and tests.
const mockVisionProvider: VisionProvider = {
  id: "mock",
  async detectCards() {
    const codes = ["BT1-009", "BT1-010", "BT1-011", "BT2-010", "BT2-011", "ST1-02", "ST1-03", "BT3-001", null];
    return codes.map((code, i) => ({
      box: { x: 0.05 + (i % 3) * 0.31, y: 0.05 + Math.floor(i / 3) * 0.31, width: 0.29, height: 0.29 },
      code,
      name: null,
      finish: i === 4 ? ("foil" as const) : null,
    }));
  },
};

export const visionProviders: Record<string, VisionProvider> = {
  gemini: geminiVisionProvider,
  mock: mockVisionProvider,
};
