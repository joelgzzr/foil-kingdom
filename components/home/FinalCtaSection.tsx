import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth-guard";
import { es } from "@/lib/i18n/es";

// Session read: render inside <Suspense>. Logged-in users already have an account.
export default async function FinalCtaSection() {
  if (await getCurrentUser()) return null;

  return (
    <section className="mx-auto w-full max-w-6xl px-4 pb-14 pt-4">
      <div className="grid justify-items-center gap-3 rounded-3xl border bg-linear-to-br from-primary/10 via-background to-fuchsia-500/10 p-10 text-center">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{es.home.finalTitle}</h2>
        <p className="max-w-lg text-muted-foreground">{es.home.finalBody}</p>
        <Link href="/signup" className={buttonVariants({ size: "lg", className: "mt-2" })}>
          {es.home.ctaSignup}
        </Link>
      </div>
    </section>
  );
}
