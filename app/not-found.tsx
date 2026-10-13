import type { Metadata } from "next";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { es } from "@/lib/i18n/es";

export const metadata: Metadata = { title: es.notFoundPage.title };

export default function NotFound() {
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-16">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -right-24 -top-24 size-[26rem] rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -bottom-32 left-0 size-[22rem] rounded-full bg-cyan-400/15 blur-3xl" />
      </div>

      <div className="relative grid max-w-md justify-items-center gap-6 text-center">
        <div aria-hidden className="relative h-44 w-40">
          <div className="absolute inset-0 -rotate-12 rounded-xl bg-muted shadow-lg ring-1 ring-foreground/10" />
          <div className="absolute inset-0 rotate-6 rounded-xl bg-linear-to-br from-indigo-500 to-violet-700 shadow-xl ring-1 ring-foreground/10">
            <div className="absolute inset-2 flex items-center justify-center rounded-lg border border-white/30">
              <span className="text-6xl font-bold text-white/90">404</span>
            </div>
          </div>
        </div>

        <div className="grid gap-2">
          <h1 className="text-balance text-3xl font-semibold tracking-tight">{es.notFoundPage.title}</h1>
          <p className="text-pretty text-muted-foreground">{es.notFoundPage.body}</p>
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/" className={buttonVariants({ size: "lg" })}>
            {es.notFoundPage.home}
          </Link>
          <Link href="/cards" className={buttonVariants({ size: "lg", variant: "outline" })}>
            {es.notFoundPage.browse}
          </Link>
        </div>
      </div>
    </main>
  );
}
