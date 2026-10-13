"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, ok } from "@/lib/action-result";
import { requireActiveUser } from "@/lib/auth-guard";
import { es } from "@/lib/i18n/es";
import { addressSchema } from "@/lib/schemas/address";
import { createClient } from "@/lib/supabase/server";

const idSchema = z.uuid();

export async function createAddressAction(input: unknown) {
  const user = await requireActiveUser();
  const parsed = addressSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? es.errors.generic, "validation");
  const a = parsed.data;

  const supabase = await createClient();
  const { count } = await supabase.from("addresses").select("id", { count: "exact", head: true });
  const makeDefault = a.isDefault || (count ?? 0) === 0;

  // The partial unique index allows a single default per user, so clear the previous one first.
  if (makeDefault) await supabase.from("addresses").update({ is_default: false }).eq("user_id", user.id);

  const { error } = await supabase.from("addresses").insert({
    user_id: user.id,
    label: a.label || null,
    recipient_name: a.recipientName,
    phone: a.phone,
    street: a.street,
    exterior_number: a.exteriorNumber,
    interior_number: a.interiorNumber || null,
    neighborhood: a.neighborhood,
    municipality: a.municipality,
    state: a.state,
    postal_code: a.postalCode,
    reference: a.reference || null,
    is_default: makeDefault,
  });
  if (error) return fail(es.errors.generic);

  revalidatePath("/account");
  return ok(undefined, es.account.addressSaved);
}

export async function setDefaultAddressAction(id: unknown) {
  const user = await requireActiveUser();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return fail(es.errors.generic, "validation");

  const supabase = await createClient();
  await supabase.from("addresses").update({ is_default: false }).eq("user_id", user.id);
  const { error } = await supabase
    .from("addresses")
    .update({ is_default: true })
    .eq("id", parsed.data)
    .eq("user_id", user.id);
  if (error) return fail(es.errors.generic);

  revalidatePath("/account");
  return ok();
}

export async function deleteAddressAction(id: unknown) {
  const user = await requireActiveUser();
  const parsed = idSchema.safeParse(id);
  if (!parsed.success) return fail(es.errors.generic, "validation");

  const supabase = await createClient();
  const { error } = await supabase.from("addresses").delete().eq("id", parsed.data).eq("user_id", user.id);
  if (error) return fail(es.errors.generic);

  revalidatePath("/account");
  return ok(undefined, es.account.addressDeleted);
}
