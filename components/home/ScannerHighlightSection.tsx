import { ScanLine } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { es } from "@/lib/i18n/es";

export default function ScannerHighlightSection() {
  return (
    <section className="mx-auto w-full max-w-6xl px-4 py-10">
      <div className="relative flex flex-wrap items-center justify-between gap-6 overflow-hidden rounded-3xl bg-linear-to-br from-indigo-600 to-violet-700 p-8 text-white sm:p-10">
        <ScanLine aria-hidden className="absolute -right-6 -top-6 size-48 text-white/10" />
        <div className="relative grid max-w-xl gap-2">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{es.scan.homeTitle}</h2>
          <p className="text-white/80">{es.scan.homeBody}</p>
        </div>
        <Link href="/sell/scan" className={buttonVariants({ variant: "secondary", size: "lg", className: "relative" })}>
          {es.scan.cta}
        </Link>
      </div>
    </section>
  );
}
