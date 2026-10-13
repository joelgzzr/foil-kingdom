import { z } from "zod";

import { es } from "@/lib/i18n/es";
import { CONDITIONS, LANGUAGES } from "@/lib/schemas/listing";

export const MAX_SCAN_LISTINGS = 200;

// Scans only distinguish regular from foil; parallels are picked as a different print.
export const scanItemSchema = z.object({
  printId: z.uuid(es.listing.errors.cardRequired),
  condition: z.enum(CONDITIONS),
  language: z.enum(LANGUAGES),
  finish: z.enum(["regular", "foil"]),
  quantity: z.number().int().min(1, es.listing.errors.stockRange).max(999, es.listing.errors.stockRange),
  // Per copy, in pesos; stored as integer centavos.
  price: z.number(es.errors.required).min(1, es.listing.errors.priceRange).max(1_000_000, es.listing.errors.priceRange),
  acceptsOffers: z.boolean(),
});

export const scanListingsSchema = z.object({
  items: z.array(scanItemSchema).min(1, es.scan.errors.empty).max(MAX_SCAN_LISTINGS, es.scan.errors.tooMany),
  publish: z.boolean(),
  // How many cards the seller changed from the suggestion; accuracy telemetry only.
  corrected: z.number().int().min(0).max(MAX_SCAN_LISTINGS),
});

export type ScanItemInput = z.infer<typeof scanItemSchema>;
export type ScanListingsInput = z.infer<typeof scanListingsSchema>;
