import type { Metadata } from "next";

import LegalDocument from "@/components/legal/LegalDocument";
import { es } from "@/lib/i18n/es";

export const metadata: Metadata = { title: es.legal.privacy.title };

export default function PrivacyPage() {
  return <LegalDocument {...es.legal.privacy} />;
}
