import { z } from "zod";

import { es } from "@/lib/i18n/es";
import { PACKAGE_PRESET_IDS } from "@/lib/orders/packages";

export const createOrderSchema = z.object({
  // Total for every card in the conversation, entered in pesos; converted to centavos on the server.
  price: z.number(es.errors.required).min(1, es.orders.create.priceRange).max(1_000_000, es.orders.create.priceRange),
  packagePreset: z.enum(PACKAGE_PRESET_IDS, es.errors.required),
  originAddressId: z.uuid(es.errors.required),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
