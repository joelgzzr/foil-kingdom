"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, ok } from "@/lib/action-result";
import { requireActiveUser } from "@/lib/auth-guard";
import { es } from "@/lib/i18n/es";
import { wishlistMaxPriceSchema } from "@/lib/schemas/trust";
import { createClient } from "@/lib/supabase/server";

const idSchema = z.uuid();

export async function addToWishlistAction(printId: unknown) {
  const user = await requireActiveUser();
  const parsed = idSchema.safeParse(printId);
  if (!parsed.success) return fail(es.errors.generic, "validation");

  const supabase = await createClient();
  const { error } = await supabase.from("wishlist_items").insert({ user_id: user.id, print_id: parsed.data });
  // Already on the list: treat as success.
  if (error && error.code !== "23505") {
    if (error.code === "23514") return fail(es.trust.wishlist.full, "conflict");
    return fail(es.errors.generic);
  }
  revalidatePath("/wishlist");
  return ok(undefined, es.trust.wishlist.added);
}

export async function removeFromWishlistAction(printId: unknown) {
  const user = await requireActiveUser();
  const parsed = idSchema.safeParse(printId);
  if (!parsed.success) return fail(es.errors.generic, "validation");

  const supabase = await createClient();
  const { error } = await supabase.from("wishlist_items").delete().eq("user_id", user.id).eq("print_id", parsed.data);
  if (error) return fail(es.errors.generic);
  revalidatePath("/wishlist");
  return ok(undefined, es.trust.wishlist.removed);
}

export async function updateWishlistMaxPriceAction(printId: unknown, maxPrice: unknown) {
  const user = await requireActiveUser();
  const parsedId = idSchema.safeParse(printId);
  const parsedPrice = wishlistMaxPriceSchema.safeParse(maxPrice);
  if (!parsedId.success) return fail(es.errors.generic, "validation");
  if (!parsedPrice.success) return fail(parsedPrice.error.issues[0]?.message ?? es.errors.generic, "validation");

  const supabase = await createClient();
  const { error } = await supabase
    .from("wishlist_items")
    .update({ max_price_cents: parsedPrice.data === null ? null : Math.round(parsedPrice.data * 100) })
    .eq("user_id", user.id)
    .eq("print_id", parsedId.data);
  if (error) return fail(es.errors.generic);
  revalidatePath("/wishlist");
  return ok(undefined, es.trust.wishlist.saved);
}
