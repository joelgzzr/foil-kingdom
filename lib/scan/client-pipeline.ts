import { compressPage, cropCard, decodePhoto } from "./client-image.ts";
import type {
  DetectResponse,
  Finish,
  MatchStatus,
  ScanPrintOption,
} from "./types.ts";

export type ScanErrorCode = "invalid_image" | "daily_limit" | "failed";

export class ScanError extends Error {
  constructor(readonly code: ScanErrorCode) {
    super(code);
  }
}

// One card on the review screen. Everything here is editable by the seller.
export type ReviewCard = {
  id: string;
  pageId: string;
  cropUrl: string;
  detectedName: string | null;
  code: string | null;
  status: MatchStatus;
  options: ScanPrintOption[];
  printId: string | null;
  // The card the scanner chose, to measure how often sellers have to correct it (changing the art is expected).
  suggestedCode: string | null;
  finish: Finish;
  condition: "nm" | "lp" | "mp" | "hp" | "dmg";
  language: "en" | "ja" | "ko" | "zh";
  quantity: number;
  // Pesos typed by the seller; null follows the market suggestion.
  priceOverride: number | null;
  include: boolean;
};

async function post<T>(url: string, body: FormData): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { method: "POST", body });
  } catch {
    throw new ScanError("failed");
  }
  if (response.ok) return (await response.json()) as T;
  if (response.status === 429) throw new ScanError("daily_limit");
  if (response.status === 400) throw new ScanError("invalid_image");
  throw new ScanError("failed");
}

// Runs the whole pipeline for one photo: compress, detect and look up the cards (one request), then cut the crops
// out in the browser so the seller can compare the photo with the catalog art.
export async function analyzePage(
  file: File,
  pageId: string,
  onStage: (stage: "detecting" | "identifying") => void,
): Promise<{ cards: ReviewCard[]; usdMxnRate: number | null }> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await decodePhoto(file);
  } catch {
    throw new ScanError("invalid_image");
  }

  try {
    onStage("detecting");
    const detectForm = new FormData();
    detectForm.set("image", await compressPage(bitmap), "page.jpg");
    const { cards: detected, results, usdMxnRate } = await post<DetectResponse>("/api/scan/detect", detectForm);
    if (detected.length === 0) return { cards: [], usdMxnRate: null };

    onStage("identifying");
    const crops = await Promise.all(detected.map((card) => cropCard(bitmap, card.box)));

    const cards = detected.map((card, index): ReviewCard => {
      const result = results.find((r) => r.index === index);
      const chosen = result?.chosenPrintId ?? null;
      return {
        id: `${pageId}:${index}`,
        pageId,
        cropUrl: URL.createObjectURL(crops[index]),
        detectedName: card.name,
        code: card.code,
        status: result?.status ?? "none",
        options: result?.options ?? [],
        printId: chosen,
        suggestedCode: result?.options.find((option) => option.printId === chosen)?.code ?? null,
        finish: card.finish ?? "regular",
        condition: "nm",
        language: "en",
        quantity: 1,
        priceOverride: null,
        // Nothing starts selected: the seller confirms every card.
        include: false,
      };
    });
    return { cards, usdMxnRate };
  } finally {
    bitmap.close();
  }
}
