"use server";

import { z } from "zod";

import { fail, ok } from "@/lib/action-result";
import { requireActiveUser } from "@/lib/auth-guard";
import { es } from "@/lib/i18n/es";
import { orderProblemSchema } from "@/lib/schemas/order";
import { reportSchema } from "@/lib/schemas/trust";
import { createClient } from "@/lib/supabase/server";

export async function submitReportAction(targetType: unknown, targetId: unknown, input: unknown) {
  await requireActiveUser();
  const parsedType = z.enum(["listing", "user"]).safeParse(targetType);
  const parsedId = z.uuid().safeParse(targetId);
  const parsed = reportSchema.safeParse(input);
  if (!parsedType.success || !parsedId.success) return fail(es.errors.generic, "validation");
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? es.errors.generic, "validation");

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_report", {
    p_target_type: parsedType.data,
    p_target_id: parsedId.data,
    p_reason: parsed.data.reason,
    p_details: parsed.data.details,
  });
  if (error) {
    if (error.code === "23505") return fail(es.trust.reports.duplicate, "conflict");
    if (error.code === "54000") return fail(es.trust.reports.limit, "conflict");
    if (error.code === "P0002") return fail(es.errors.notFound, "not_found");
    return fail(es.errors.generic);
  }
  return ok(undefined, es.trust.reports.sent);
}

// Problems with an order that already has a label go to moderators, who can revoke the order.
export async function reportOrderProblemAction(orderId: unknown, input: unknown) {
  await requireActiveUser();
  const parsedId = z.uuid().safeParse(orderId);
  const parsed = orderProblemSchema.safeParse(input);
  if (!parsedId.success) return fail(es.errors.generic, "validation");
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? es.errors.generic, "validation");

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_report", {
    p_target_type: "order",
    p_target_id: parsedId.data,
    p_reason: "order_problem",
    p_details: parsed.data.details,
  });
  if (error) {
    if (error.code === "23505") return fail(es.trust.reports.duplicate, "conflict");
    if (error.code === "54000") return fail(es.trust.reports.limit, "conflict");
    if (error.code === "P0002") return fail(es.errors.notFound, "not_found");
    return fail(es.errors.generic);
  }
  return ok(undefined, es.orders.problem.sent);
}
