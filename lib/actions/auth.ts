"use server";

import { redirect } from "next/navigation";

import { fail, ok } from "@/lib/action-result";
import { es } from "@/lib/i18n/es";
import { loginSchema, signupSchema } from "@/lib/schemas/auth";
import { createClient } from "@/lib/supabase/server";

export async function signInAction(input: unknown) {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? es.errors.generic, "validation");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return fail(es.auth.invalidCredentials, "unauthorized");

  return ok();
}

export async function signUpAction(input: unknown) {
  const parsed = signupSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? es.errors.generic, "validation");
  const { username, displayName, email, password } = parsed.data;

  const supabase = await createClient();

  const { data: existing } = await supabase.from("profiles").select("id").eq("username", username).maybeSingle();
  if (existing) return fail(es.errors.usernameTaken, "conflict");

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { username, display_name: displayName ?? "", terms_accepted_at: new Date().toISOString() },
      emailRedirectTo: `${siteUrl}/auth/callback`,
    },
  });
  if (error) return fail(error.message, "validation");

  // With email confirmations enabled there is no session until the user confirms.
  return ok({ signedIn: Boolean(data.session) });
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
