"use server";

import { z } from "zod";

import { fail, ok } from "@/lib/action-result";
import { requireActiveUser } from "@/lib/auth-guard";
import { es } from "@/lib/i18n/es";
import { CHAT_MESSAGE_COLUMNS, messageSchema, offerSchema, type ChatMessage } from "@/lib/schemas/message";
import { createClient } from "@/lib/supabase/server";

const idSchema = z.uuid();
const listingIdsSchema = z.array(z.uuid()).min(1).max(50);
const quantitiesSchema = z.array(z.number().int().min(1).max(999)).min(1).max(50);

// Quantities are optional but must line up with the listing ids.
function parseListingLines(listingIds: unknown, quantities: unknown) {
  const ids = listingIdsSchema.safeParse(listingIds);
  if (!ids.success) return null;
  if (quantities === undefined) return { ids: ids.data, quantities: undefined };
  const parsed = quantitiesSchema.safeParse(quantities);
  if (!parsed.success || parsed.data.length !== ids.data.length) return null;
  return { ids: ids.data, quantities: parsed.data };
}

// Maps the bundle RPC errors (see 20261014110000_bundle_conversations.sql) to user-facing copy.
function bundleError(error: { code?: string; message?: string }) {
  if (error.code === "P0002") return fail(es.messages.notAvailable, "not_found");
  if (error.code === "42501") return fail(es.errors.generic, "unauthorized");
  if (error.code === "54000") {
    return fail(error.message?.includes("Too many") ? es.messages.tooManyItems : es.errors.rateLimited, "conflict");
  }
  if (error.code === "23514") {
    if (error.message?.includes("yourself")) return fail(es.messages.ownListing, "conflict");
    if (error.message?.includes("Order pending")) return fail(es.messages.orderPending, "conflict");
    if (error.message?.includes("stock")) return fail(es.messages.items.notEnoughStock, "conflict");
    if (error.message?.includes("Offers unavailable")) return fail(es.messages.offersDisabled, "validation");
    if (error.message?.includes("offer amount")) return fail(es.messages.offerRange, "validation");
  }
  return fail(es.errors.generic);
}

// Opens (or reuses) the buyer's conversation with the seller and adds the listings to it.
export async function startConversationAction(listingIds: unknown, quantities?: unknown) {
  await requireActiveUser();
  const lines = parseListingLines(listingIds, quantities);
  if (!lines) return fail(es.errors.generic, "validation");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_conversation", {
    p_listing_ids: lines.ids,
    p_quantities: lines.quantities,
  });
  if (error || !data) return error ? bundleError(error) : fail(es.errors.generic);
  return ok({ id: data });
}

export async function addConversationItemsAction(conversationId: unknown, listingIds: unknown, quantities?: unknown) {
  await requireActiveUser();
  const parsedId = idSchema.safeParse(conversationId);
  const lines = parseListingLines(listingIds, quantities);
  if (!parsedId.success || !lines) return fail(es.errors.generic, "validation");

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_conversation_items", {
    p_conversation_id: parsedId.data,
    p_listing_ids: lines.ids,
    p_quantities: lines.quantities,
  });
  return error ? bundleError(error) : ok();
}

export async function removeConversationItemAction(itemId: unknown) {
  await requireActiveUser();
  const parsed = idSchema.safeParse(itemId);
  if (!parsed.success) return fail(es.errors.generic, "validation");

  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_conversation_item", { p_item_id: parsed.data });
  return error ? bundleError(error) : ok();
}

export async function setConversationItemQuantityAction(itemId: unknown, quantity: unknown) {
  await requireActiveUser();
  const parsed = idSchema.safeParse(itemId);
  const parsedQuantity = z.number().int().min(1).max(999).safeParse(quantity);
  if (!parsed.success || !parsedQuantity.success) return fail(es.errors.generic, "validation");

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_conversation_item_quantity", {
    p_item_id: parsed.data,
    p_quantity: parsedQuantity.data,
  });
  return error ? bundleError(error) : ok();
}

export async function sendMessageAction(conversationId: unknown, input: unknown) {
  const user = await requireActiveUser();
  const parsedId = idSchema.safeParse(conversationId);
  const parsed = messageSchema.safeParse(input);
  if (!parsedId.success) return fail(es.errors.generic, "validation");
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? es.errors.generic, "validation");

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("messages")
    .insert({ conversation_id: parsedId.data, sender_id: user.id, kind: "text", body: parsed.data.body })
    .select(CHAT_MESSAGE_COLUMNS)
    .single();
  if (error) return fail(error.code === "54000" ? es.errors.rateLimited : es.errors.generic);
  return ok<ChatMessage>(data);
}

export async function makeOfferAction(conversationId: unknown, input: unknown) {
  await requireActiveUser();
  const parsedId = idSchema.safeParse(conversationId);
  const parsed = offerSchema.safeParse(input);
  if (!parsedId.success) return fail(es.errors.generic, "validation");
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? es.errors.generic, "validation");

  const supabase = await createClient();
  const { error } = await supabase.rpc("make_offer", {
    p_conversation_id: parsedId.data,
    p_amount_cents: Math.round(parsed.data.amount * 100),
  });
  if (error) return bundleError(error);
  return ok(undefined, es.messages.offerSent);
}

export async function makeFullPriceOfferAction(conversationId: unknown) {
  await requireActiveUser();
  const parsedId = idSchema.safeParse(conversationId);
  if (!parsedId.success) return fail(es.errors.generic, "validation");

  const supabase = await createClient();
  const { error } = await supabase.rpc("make_offer", { p_conversation_id: parsedId.data });
  if (error) return bundleError(error);
  return ok(undefined, es.messages.offerSent);
}

export async function counterOfferAction(messageId: unknown, input: unknown) {
  await requireActiveUser();
  const parsedId = idSchema.safeParse(messageId);
  const parsed = offerSchema.safeParse(input);
  if (!parsedId.success) return fail(es.errors.generic, "validation");
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? es.errors.generic, "validation");

  const supabase = await createClient();
  const { error } = await supabase.rpc("counter_offer", {
    p_message_id: parsedId.data,
    p_amount_cents: Math.round(parsed.data.amount * 100),
  });
  if (error) return error.code === "P0002" ? fail(es.messages.offerNotPending, "conflict") : bundleError(error);
  return ok(undefined, es.messages.counterSent);
}

export async function respondToOfferAction(messageId: unknown, action: unknown) {
  await requireActiveUser();
  const parsedId = idSchema.safeParse(messageId);
  const parsedAction = z.enum(["accept", "reject", "withdraw"]).safeParse(action);
  if (!parsedId.success || !parsedAction.success) return fail(es.errors.generic, "validation");

  const supabase = await createClient();
  const { error } = await supabase.rpc("respond_to_offer", { p_message_id: parsedId.data, p_action: parsedAction.data });
  if (error) return error.code === "P0002" ? fail(es.messages.offerNotPending, "conflict") : bundleError(error);
  return ok();
}

export async function markConversationReadAction(conversationId: unknown) {
  await requireActiveUser();
  const parsed = idSchema.safeParse(conversationId);
  if (!parsed.success) return fail(es.errors.generic, "validation");

  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_conversation_read", { p_conversation_id: parsed.data });
  return error ? fail(es.errors.generic) : ok();
}

// Returns a wa.me link; the raw number is never sent to the client.
export async function revealWhatsappAction(conversationId: unknown) {
  await requireActiveUser();
  const parsed = idSchema.safeParse(conversationId);
  if (!parsed.success) return fail(es.errors.generic, "validation");

  const supabase = await createClient();
  const [{ data: number, error }, { data: conversation }] = await Promise.all([
    supabase.rpc("reveal_whatsapp", { p_conversation_id: parsed.data }),
    supabase.from("conversations").select("listing_title").eq("id", parsed.data).maybeSingle(),
  ]);
  if (error) {
    if (error.code === "42501") return fail(es.messages.whatsappNeedsPhone, "unauthorized");
    return fail(es.errors.generic);
  }
  if (!number) return fail(es.messages.whatsappUnavailable, "not_found");

  const text = es.messages.whatsappGreeting(conversation?.listing_title ?? "");
  return ok({ url: `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(text)}` });
}
