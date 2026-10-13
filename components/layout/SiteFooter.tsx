import Link from "next/link";

import { es } from "@/lib/i18n/es";

export default function SiteFooter() {
  return (
    <footer className="border-t py-6 text-center text-xs text-muted-foreground">
      <p>
        © {es.brand.name}. Digimon Card Game es marca de sus respectivos propietarios; este sitio no está afiliado.
      </p>
      <p className="mt-1">{es.catalog.attribution}</p>
      <p className="mt-1 flex justify-center gap-3">
        <Link href="/legal/terminos" className="underline">
          {es.legal.termsLink}
        </Link>
        <Link href="/legal/privacidad" className="underline">
          {es.legal.privacyLink}
        </Link>
      </p>
    </footer>
  );
}
