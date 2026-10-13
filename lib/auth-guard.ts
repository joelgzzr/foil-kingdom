import "server-only";

import { cache } from "react";
import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

// Validates the session with the Auth server (not just the JWT), deduped per request.
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

// Same as requireUser but also blocks banned accounts from mutating data.
export async function requireActiveUser() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("banned_at").eq("id", user.id).single();
  if (profile?.banned_at) redirect("/suspended");
  return user;
}

// Staff-only pages and actions: non-moderators get a 404 so the area is not discoverable.
export async function requireModerator() {
  const user = await requireActiveUser();
  const supabase = await createClient();
  const { data: isModerator } = await supabase.rpc("is_moderator");
  if (!isModerator) notFound();
  return { user, supabase };
}
