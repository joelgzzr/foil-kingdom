import type { Tables } from "@/lib/supabase/database.types";
import type { ShippingAddress } from "@/lib/shipping/types";

type AddressRow = Pick<
  Tables<"order_addresses">,
  "recipient_name" | "phone" | "street" | "exterior_number" | "interior_number" | "neighborhood" | "municipality" | "state" | "postal_code" | "reference"
>;

export function toShippingAddress(row: AddressRow): ShippingAddress {
  return {
    name: row.recipient_name,
    phone: row.phone,
    street: row.street,
    exteriorNumber: row.exterior_number,
    interiorNumber: row.interior_number,
    neighborhood: row.neighborhood,
    municipality: row.municipality,
    state: row.state,
    postalCode: row.postal_code,
    reference: row.reference,
  };
}
