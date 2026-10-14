import Link from "next/link";
import { Suspense } from "react";

import HeaderCart from "@/components/layout/HeaderCart";
import HeaderSearch from "@/components/layout/HeaderSearch";
import UserNav from "@/components/layout/UserNav";
import { es } from "@/lib/i18n/es";

export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex min-h-14 w-full max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 md:flex-nowrap md:py-0">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            {es.brand.name}
          </Link>
          <Link href="/cards" className="text-sm text-muted-foreground hover:text-foreground">
            {es.nav.browse}
          </Link>
          <Link href="/sell" className="text-sm text-muted-foreground hover:text-foreground">
            {es.nav.sell}
          </Link>
        </div>
        {/* Own row on phones (order-last), centered and flexible from md up. */}
        <div className="order-last w-full md:order-none md:mx-auto md:max-w-md md:flex-1">
          <HeaderSearch />
        </div>
        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <HeaderCart />
          {/* Session read is request-time, so it streams in behind Suspense. */}
          <Suspense fallback={<div className="h-8 w-24" aria-hidden />}>
            <UserNav />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
