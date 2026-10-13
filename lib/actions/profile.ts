"use server";

import { revalidatePath } from "next/cache";

import { fail, ok } from "@/lib/action-result";
import { requireActiveUser } from "@/lib/auth-guard";
import { es } from "@/lib/i18n/es";
import {
  phoneRequestSchema,
  phoneVerifySchema,
  profileSchema,
  whatsappSchema,
} from "@/lib/schemas/profile";
import { createClient } from "@/lib/supabase/server";
import { supabaseUrl } from "@/lib/supabase/env";

const firstIssue = (issues: { message: string }[]) => issues[0]?.message ?? es.errors.generic;

const AVATAR_PUBLIC_PREFIX = "/storage/v1/object/public/avatars/";
const AVATAR_PATH = /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(webp|jpg|png)$/;

// Only objects inside the user's own folder are ever removed.
async function removeStoredAvatar(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, url: string | null) {
  const index = url?.indexOf(AVATAR_PUBLIC_PREFIX) ?? -1;
  if (!url || index === -1) return;
  const path = url.slice(index + AVATAR_PUBLIC_PREFIX.length);
  if (path.startsWith(`${userId}/`)) await supabase.storage.from("avatars").remove([path]);
}

export async function setAvatarAction(path: string) {
  const user = await requireActiveUser();
  if (typeof path !== "string" || !AVATAR_PATH.test(path) || !path.startsWith(`${user.id}/`)) {
    return fail(es.errors.generic, "validation");
  }

  const supabase = await createClient();
  const { data: current } = await supabase.from("profiles").select("avatar_url").eq("id", user.id).single();
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_url: `${supabaseUrl()}${AVATAR_PUBLIC_PREFIX}${path}` })
    .eq("id", user.id);
  if (error) {
    await supabase.storage.from("avatars").remove([path]);
    return fail(es.errors.generic);
  }

  await removeStoredAvatar(supabase, user.id, current?.avatar_url ?? null);
  revalidatePath("/account");
  return ok(undefined, es.account.avatarSaved);
}

export async function removeAvatarAction() {
  const user = await requireActiveUser();
  const supabase = await createClient();
  const { data: current } = await supabase.from("profiles").select("avatar_url").eq("id", user.id).single();
  const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id);
  if (error) return fail(es.errors.generic);

  await removeStoredAvatar(supabase, user.id, current?.avatar_url ?? null);
  revalidatePath("/account");
  return ok(undefined, es.account.avatarRemoved);
}

export async function updateProfileAction(input: unknown) {
  const user = await requireActiveUser();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error.issues), "validation");

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: parsed.data.displayName || null,
      bio: parsed.data.bio || null,
      state: parsed.data.state || null,
      city: parsed.data.city || null,
    })
    .eq("id", user.id);
  if (error) return fail(es.errors.generic);

  revalidatePath("/account");
  return ok(undefined, es.account.saved);
}

export async function updateWhatsappAction(input: unknown) {
  const user = await requireActiveUser();
  const parsed = whatsappSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error.issues), "validation");

  const supabase = await createClient();
  const { error } = await supabase
    .from("profile_private")
    .update({
      whatsapp_number: parsed.data.number ? `+52${parsed.data.number}` : null,
      whatsapp_visible: parsed.data.number ? parsed.data.visible : false,
    })
    .eq("id", user.id);
  if (error) return fail(es.errors.generic);

  revalidatePath("/account");
  return ok(undefined, es.account.saved);
}

export async function requestPhoneVerificationAction(input: unknown) {
  await requireActiveUser();
  const parsed = phoneRequestSchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error.issues), "validation");

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ phone: `+52${parsed.data.phone}` });
  if (error) return fail(error.message);

  return ok(undefined, es.account.codeSent);
}

export async function verifyPhoneAction(input: unknown) {
  await requireActiveUser();
  const parsed = phoneVerifySchema.safeParse(input);
  if (!parsed.success) return fail(firstIssue(parsed.error.issues), "validation");

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    phone: `+52${parsed.data.phone}`,
    token: parsed.data.code,
    type: "phone_change",
  });
  if (error) return fail(error.message, "validation");

  revalidatePath("/account");
  return ok(undefined, es.account.phoneVerifiedToast);
}
