import { z } from "zod";

import { es } from "@/lib/i18n/es";
import { MX_STATES } from "@/lib/mx";

const phone10 = z.string().trim().regex(/^[0-9]{10}$/, es.errors.phone10);

export const profileSchema = z.object({
  displayName: z.string().trim().max(60, es.errors.tooLong),
  bio: z.string().trim().max(500, es.errors.tooLong),
  state: z.enum(MX_STATES).or(z.literal("")),
  city: z.string().trim().max(80, es.errors.tooLong),
});

export const whatsappSchema = z.object({
  number: phone10.or(z.literal("")),
  visible: z.boolean(),
});

export const phoneRequestSchema = z.object({ phone: phone10 });

export const phoneVerifySchema = z.object({
  phone: phone10,
  code: z.string().trim().regex(/^[0-9]{6}$/, es.errors.code6),
});

export type ProfileInput = z.infer<typeof profileSchema>;
export type WhatsappInput = z.infer<typeof whatsappSchema>;
export type PhoneRequestInput = z.infer<typeof phoneRequestSchema>;
export type PhoneVerifyInput = z.infer<typeof phoneVerifySchema>;
