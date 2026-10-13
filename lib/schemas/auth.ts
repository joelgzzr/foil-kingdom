import { z } from "zod";

import { es } from "@/lib/i18n/es";

export const loginSchema = z.object({
  email: z.string().trim().min(1, es.errors.required).email(es.errors.invalidEmail),
  password: z.string().min(1, es.errors.required),
});

export const signupSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,20}$/, es.errors.usernameFormat),
  displayName: z.string().trim().max(60, es.errors.tooLong).optional(),
  email: z.string().trim().min(1, es.errors.required).email(es.errors.invalidEmail),
  password: z.string().min(8, es.errors.passwordMin).max(72, es.errors.tooLong),
  acceptTerms: z.literal(true, es.legal.acceptTermsRequired),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
