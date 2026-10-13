import { z } from "zod";

import { es } from "@/lib/i18n/es";
import { MX_STATES } from "@/lib/mx";

// Length caps follow shipping aggregator field limits (names and references are the tightest).
const required = (max: number) => z.string().trim().min(1, es.errors.required).max(max, es.errors.tooLong);
const optional = (max: number) => z.string().trim().max(max, es.errors.tooLong);

export const addressSchema = z.object({
  label: optional(30),
  recipientName: required(30),
  phone: z.string().trim().regex(/^[0-9]{10}$/, es.errors.phone10),
  street: required(35),
  exteriorNumber: required(10),
  interiorNumber: optional(10),
  neighborhood: required(35),
  municipality: required(35),
  state: z.enum(MX_STATES, es.errors.required),
  postalCode: z.string().trim().regex(/^[0-9]{5}$/, es.errors.postalCode5),
  reference: optional(30),
  isDefault: z.boolean(),
});

export type AddressInput = z.infer<typeof addressSchema>;
