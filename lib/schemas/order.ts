import { z } from "zod";

import { es } from "@/lib/i18n/es";
import { PACKAGE_PRESET_IDS } from "@/lib/orders/packages";

export const createOrderSchema = z.object({
  packagePreset: z.enum(PACKAGE_PRESET_IDS, es.errors.required),
  originAddressId: z.uuid(es.errors.required),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const cancelOrderSchema = z.object({
  reason: z.string().trim().min(5, es.orders.cancelDialog.reasonRequired).max(300, es.errors.tooLong),
});

export const orderProblemSchema = z.object({
  details: z.string().trim().min(10, es.orders.problem.detailsRequired).max(1000, es.errors.tooLong),
});

export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;
export type OrderProblemInput = z.infer<typeof orderProblemSchema>;
