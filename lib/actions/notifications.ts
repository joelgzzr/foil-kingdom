"use server";

import { revalidatePath } from "next/cache";

import { fail, ok } from "@/lib/action-result";
import { requireActiveUser } from "@/lib/auth-guard";
import { es } from "@/lib/i18n/es";
import { createClient } from "@/lib/supabase/server";

export async function markNotificationsReadAction() {
  await requireActiveUser();
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_notifications_read");
  if (error) return fail(es.errors.generic);
  revalidatePath("/notifications");
  return ok();
}
