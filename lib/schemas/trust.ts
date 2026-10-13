import { z } from "zod";

import { es } from "@/lib/i18n/es";

export const ratingSchema = z.object({
  stars: z.number(es.errors.required).int().min(1, es.trust.ratings.invalid).max(5, es.trust.ratings.invalid),
  comment: z.string().trim().max(500, es.errors.tooLong),
});

export const REPORT_REASONS = ["fraud", "counterfeit", "inappropriate", "spam", "other"] as const;

export const reportSchema = z.object({
  reason: z.enum(REPORT_REASONS, es.errors.required),
  details: z.string().trim().max(1000, es.errors.tooLong),
});

// Entered in pesos; converted to centavos on the server. null removes the limit.
export const wishlistMaxPriceSchema = z
  .number(es.errors.required)
  .min(1, es.trust.wishlist.priceRange)
  .max(1_000_000, es.trust.wishlist.priceRange)
  .nullable();

export const resolveReportSchema = z.object({
  action: z.enum(["dismiss", "remove_listing", "ban_user"]),
  note: z.string().trim().max(500, es.errors.tooLong),
});

export type RatingInput = z.infer<typeof ratingSchema>;
export type ReportInput = z.infer<typeof reportSchema>;
