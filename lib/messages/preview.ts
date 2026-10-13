import { es } from "@/lib/i18n/es";
import { formatMXN } from "@/lib/money";

export function previewText(kind: string | null, preview: string | null) {
  if (kind === "offer" && preview) return es.messages.offerLabel(formatMXN(Number(preview)));
  if (kind === "system" && preview) return es.messages.system[preview as keyof typeof es.messages.system] ?? "";
  return preview ?? "";
}
