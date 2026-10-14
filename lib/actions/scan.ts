"use server";

import { revalidatePath, updateTag } from "next/cache";

import { fail, ok } from "@/lib/action-result";
import { requireActiveUser } from "@/lib/auth-guard";
import { es } from "@/lib/i18n/es";
import { priceToCents } from "@/lib/schemas/listing";
import { scanListingsSchema } from "@/lib/schemas/scan";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Creates one draft listing per reviewed card in a single transaction, then optionally publishes them.
export async function createListingsFromScanAction(input: unknown) {
  const user = await requireActiveUser();
  const parsed = scanListingsSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? es.errors.generic, "validation");
  const { items, publish, corrected } = parsed.data;

  const supabase = await createClient();
  const { data: ids, error } = await supabase.rpc("create_listings_from_scan", {
    p_items: items.map((item) => ({
      print_id: item.printId,
      condition: item.condition,
      language: item.language,
      finish: item.finish,
      quantity: item.quantity,
      price_cents: priceToCents(item.price),
    })),
  });
  if (error?.code === "54000") return fail(es.errors.rateLimited, "conflict");
  if (error || !ids) return fail(es.errors.generic);

  let published = false;
  if (publish) {
    // RLS only lets verified, non-banned sellers activate listings; otherwise the drafts stay as they are.
    const { data: activated, error: publishError } = await supabase
      .from("listings")
      .update({ status: "active" })
      .in("id", ids)
      .eq("seller_id", user.id)
      .select("id");
    published = !publishError && (activated?.length ?? 0) === ids.length;
  }

  await createAdminClient().rpc("record_scan_stats", { p_user_id: user.id, p_detected: 0, p_corrected: corrected });

  updateTag("listings");
  revalidatePath("/sell");
  return ok(
    { count: ids.length, published },
    publish && !published ? es.scan.savedAsDrafts : published ? es.scan.published(ids.length) : es.scan.drafted(ids.length),
  );
}

// Publishes every draft the scanner created for the seller. RLS requires a verified phone.
export async function publishScanDraftsAction() {
  const user = await requireActiveUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings")
    .update({ status: "active" })
    .eq("seller_id", user.id)
    .eq("source", "scan")
    .eq("status", "draft")
    .select("id");
  if (error || !data || data.length === 0) return fail(es.listing.phoneRequired, "unauthorized");

  updateTag("listings");
  revalidatePath("/sell");
  return ok({ count: data.length }, es.scan.draftsPublished(data.length));
}
