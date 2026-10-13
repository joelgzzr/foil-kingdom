// Shared by the scan API, the providers and the scan UI. No server-only imports: node scripts use it too.

export type ScanImage = { bytes: Uint8Array; mimeType: "image/jpeg" | "image/png" | "image/webp" };

// Normalized 0-1 coordinates relative to the page image, origin top-left.
export type CardBox = { x: number; y: number; width: number; height: number };

export type Finish = "regular" | "foil";

// What the vision model claims about one card on the page. Hints only: everything is verified against the catalog.
export type DetectedCard = {
  box: CardBox;
  code: string | null;
  name: string | null;
  finish: Finish | null;
};

export type VisionProvider = {
  id: string;
  detectCards(image: ScanImage): Promise<DetectedCard[]>;
};

export type ScanPrintOption = {
  printId: string;
  slug: string;
  code: string;
  name: string;
  variantLabel: string | null;
  isDefault: boolean;
  imageUrl: string | null;
  // TCGplayer reference prices in USD cents.
  marketUsdCents: { normal: number | null; foil: number | null };
};

// matched: the printed code and name agree on one card. suggested: candidates found, none certain. none: nothing found.
export type MatchStatus = "matched" | "suggested" | "none";

export type IdentifyResult = {
  index: number;
  status: MatchStatus;
  chosenPrintId: string | null;
  // The candidate cards, best first; every print of each card, base print first.
  options: ScanPrintOption[];
};

export type DetectResponse = { cards: DetectedCard[]; results: IdentifyResult[]; usdMxnRate: number };
