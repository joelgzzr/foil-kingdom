import type { Metadata } from "next";

import LegalDocument from "@/components/legal/LegalDocument";
import { es } from "@/lib/i18n/es";

export const metadata: Metadata = { title: es.legal.terms.title };

export default function TermsPage() {
  return <LegalDocument {...es.legal.terms} />;
}
