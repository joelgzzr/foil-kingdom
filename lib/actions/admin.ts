"use server";

import { revalidatePath, updateTag } from "next/cache";
import { z } from "zod";

import { fail, ok } from "@/lib/action-result";
import { requireModerator } from "@/lib/auth-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { es } from "@/lib/i18n/es";
import { retryLabelPurchase, revokeOrder } from "@/lib/orders/process";
import { cancelOrderSchema } from "@/lib/schemas/order";
import { resolveReportSchema } from "@/lib/schemas/trust";

const idSchema = z.uuid();

// Authorization is enforced twice: requireModerator() here and is_moderator() inside the RPCs.
export async function resolveReportAction(reportId: unknown, input: unknown) {
  const { supabase } = await requireModerator();
  const parsedId = idSchema.safeParse(reportId);
  const parsed = resolveReportSchema.safeParse(input);
  if (!parsedId.success || !parsed.success) return fail(es.errors.generic, "validation");

  const { error } = await supabase.rpc("resolve_report", {
    p_report_id: parsedId.data,
    p_action: parsed.data.action,
    p_note: parsed.data.note,
  });
  if (error) return fail(es.errors.generic);

  updateTag("listings");
  revalidatePath("/admin");
  return ok(undefined, es.admin.resolved);
}

export async function unbanUserAction(userId: unknown) {
  const { supabase } = await requireModerator();
  const parsed = idSchema.safeParse(userId);
  if (!parsed.success) return fail(es.errors.generic, "validation");

  const { error } = await supabase.rpc("unban_user", { p_user_id: parsed.data });
  if (error) return fail(es.errors.generic);
  revalidatePath("/admin");
  return ok(undefined, es.admin.unbanned);
}

const catalogResolutionSchema = z.union([
  z.object({ code: z.string().trim().min(1).max(30) }),
  z.object({ ignore: z.literal(true) }),
]);

// Stores a manual match rule; the next catalog sync applies it (and moves the record out of the queue).
export async function resolveCatalogRecordAction(recordId: unknown, input: unknown) {
  await requireModerator();
  const parsedId = idSchema.safeParse(recordId);
  const parsed = catalogResolutionSchema.safeParse(input);
  if (!parsedId.success || !parsed.success) return fail(es.errors.generic, "validation");

  // Trusted server code after requireModerator(): these tables grant nothing to normal roles.
  const admin = createAdminClient();
  const { data: record } = await admin
    .from("catalog_source_records")
    .select("source, external_id")
    .eq("id", parsedId.data)
    .eq("match_method", "unmatched")
    .maybeSingle();
  if (!record) return fail(es.errors.notFound, "not_found");

  if ("code" in parsed.data) {
    const { data: card } = await admin.from("cards").select("code").eq("code", parsed.data.code).maybeSingle();
    if (!card) return fail(es.errors.notFound, "not_found");
    const { error } = await admin
      .from("catalog_match_overrides")
      .upsert({ source: record.source, external_id: record.external_id, code: card.code, ignore: false });
    if (error) return fail(es.errors.generic);
  } else {
    const { error } = await admin
      .from("catalog_match_overrides")
      .upsert({ source: record.source, external_id: record.external_id, code: null, ignore: true });
    if (error) return fail(es.errors.generic);
  }

  revalidatePath("/admin");
  return ok(undefined, es.admin.catalogResolved);
}

export async function retryLabelAction(orderId: unknown) {
  await requireModerator();
  const parsed = idSchema.safeParse(orderId);
  if (!parsed.success) return fail(es.errors.generic, "validation");

  const result = await retryLabelPurchase(parsed.data);
  revalidatePath("/admin");
  if (!result.retried) return fail(es.errors.generic, "conflict");
  return result.succeeded ? ok(undefined, es.admin.retryDone) : fail(es.admin.retryFailed);
}

// Cancels the reported order (void label, refund, restore stock) and closes the report.
export async function revokeOrderAction(reportId: unknown, input: unknown) {
  const { supabase } = await requireModerator();
  const parsedId = idSchema.safeParse(reportId);
  const parsed = cancelOrderSchema.safeParse(input);
  if (!parsedId.success) return fail(es.errors.generic, "validation");
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? es.errors.generic, "validation");

  const admin = createAdminClient();
  const { data: report } = await admin
    .from("reports")
    .select("target_id")
    .eq("id", parsedId.data)
    .eq("target_type", "order")
    .eq("status", "open")
    .maybeSingle();
  if (!report) return fail(es.errors.notFound, "not_found");

  const result = await revokeOrder(supabase, report.target_id, parsed.data.reason);
  if (!result.revoked) return fail(es.errors.generic, "conflict");

  await supabase.rpc("resolve_report", { p_report_id: parsedId.data, p_action: "revoke_order", p_note: parsed.data.reason });
  revalidatePath("/admin");
  revalidatePath("/orders");
  updateTag("listings");
  return ok(undefined, result.manualFollowUp ? es.admin.revokedManual : es.admin.revoked);
}

export async function markRefundedAction(paymentId: unknown) {
  await requireModerator();
  const parsed = idSchema.safeParse(paymentId);
  if (!parsed.success) return fail(es.errors.generic, "validation");

  const admin = createAdminClient();
  const { error } = await admin
    .from("payments")
    .update({ status: "refunded", refund_needed: false })
    .eq("id", parsed.data)
    .eq("refund_needed", true);
  if (error) return fail(es.errors.generic);
  revalidatePath("/admin");
  return ok(undefined, es.admin.refundMarked);
}
