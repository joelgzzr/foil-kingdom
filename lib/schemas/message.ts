import { z } from "zod";

import { es } from "@/lib/i18n/es";

export const messageSchema = z.object({
  body: z.string().trim().min(1, es.errors.required).max(1000, es.errors.tooLong),
});

export const offerSchema = z.object({
  // Entered in pesos; converted to centavos on the server.
  amount: z.number(es.errors.required).min(1, es.messages.offerRange).max(1_000_000, es.messages.offerRange),
});

export type MessageInput = z.infer<typeof messageSchema>;
export type OfferInput = z.infer<typeof offerSchema>;

export type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  kind: string;
  body: string | null;
  offer_cents: number | null;
  offer_status: string | null;
  offer_scope: string | null;
  offer_item_id: string | null;
  note: string | null;
  created_at: string;
};

export const CHAT_MESSAGE_COLUMNS = "id, conversation_id, sender_id, kind, body, offer_cents, offer_status, offer_scope, offer_item_id, note, created_at";
