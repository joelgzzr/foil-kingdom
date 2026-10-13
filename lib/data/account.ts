import "server-only";

import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

export async function getAccountData(userId: string) {
  const supabase = await createClient();

  const [profile, contact, addresses] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).single(),
    supabase.from("profile_private").select("*").eq("id", userId).single(),
    supabase.from("addresses").select("*").eq("user_id", userId).order("is_default", { ascending: false }).order("created_at"),
  ]);

  if (profile.error || contact.error) throw new Error("Failed to load account");

  return { profile: profile.data, contact: contact.data, addresses: addresses.data ?? [] };
}

export type AccountData = Awaited<ReturnType<typeof getAccountData>>;

// Header identity; cached per request so the navbar and page share one query.
export const getNavProfile = cache(async (userId: string) => {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("username, display_name, avatar_url").eq("id", userId).single();
  return data;
});
