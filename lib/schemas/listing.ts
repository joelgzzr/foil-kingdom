import { z } from "zod";

import { es } from "@/lib/i18n/es";

// Lots and sealed product are pinned for later; the database still supports them.
export const CONDITIONS = ["nm", "lp", "mp", "hp", "dmg"] as const;
export const LANGUAGES = ["en", "ja", "ko", "zh"] as const;
export const FINISHES = ["regular", "foil", "parallel"] as const;

export const MAX_PHOTOS = 8;

export const listingSchema = z
  .object({
    printId: z.uuid(es.listing.errors.cardRequired),
    // Display only; the server never trusts it.
    cardLabel: z.string().max(200).optional(),
    condition: z.enum(CONDITIONS),
    language: z.enum(LANGUAGES),
    finish: z.enum(FINISHES),
    // Copies in stock.
    quantity: z.number(es.errors.required).int(es.errors.required).min(1, es.listing.errors.stockRange).max(999, es.listing.errors.stockRange),
    // Per copy, entered in pesos; stored as integer centavos.
    price: z.number(es.errors.required),
  })
  .superRefine((value, ctx) => {
    if (!Number.isFinite(value.price) || value.price < 1 || value.price > 1_000_000) {
      ctx.addIssue({ code: "custom", path: ["price"], message: es.listing.errors.priceRange });
    }
  });

export type ListingInput = z.infer<typeof listingSchema>;

export const priceToCents = (pesos: number) => Math.round(pesos * 100);
