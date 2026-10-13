"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";

import { fail, ok } from "@/lib/action-result";
import { requireActiveUser } from "@/lib/auth-guard";
import { es } from "@/lib/i18n/es";
import { ratingSchema } from "@/lib/schemas/trust";
import { createClient } from "@/lib/supabase/server";

export async function submitRatingAction(orderId: unknown, input: unknown) {
  await requireActiveUser();
  const parsedId = z.uuid().safeParse(orderId);
  const parsed = ratingSchema.safeParse(input);
  if (!parsedId.success) return fail(es.errors.generic, "validation");
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? es.errors.generic, "validation");

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_rating", {
    p_order_id: parsedId.data,
    p_stars: parsed.data.stars,
    p_comment: parsed.data.comment,
  });
  if (error) {
    if (error.code === "23505") return fail(es.trust.ratings.alreadyRated, "conflict");
    return fail(es.errors.generic);
  }
  updateTag("ratings");
  updateTag("listings");
  revalidatePath("/messages", "layout");
  return ok(undefined, es.trust.ratings.sent);
}
