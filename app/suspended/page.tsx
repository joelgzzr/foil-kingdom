import type { Metadata } from "next";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { es } from "@/lib/i18n/es";

export const metadata: Metadata = { title: es.trust.suspended.title };

export default function SuspendedPage() {
  return (
    <main className="mx-auto grid w-full max-w-xl gap-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">{es.trust.suspended.title}</h1>
      <p className="text-muted-foreground">{es.trust.suspended.body}</p>
      <div>
        <Link href="/" className={buttonVariants({ variant: "outline" })}>
          {es.trust.suspended.home}
        </Link>
      </div>
    </main>
  );
}
