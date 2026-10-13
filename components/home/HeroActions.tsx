import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth-guard";
import { es } from "@/lib/i18n/es";

export function HeroActionsFallback() {
  return (
    <Link href="/cards" className={buttonVariants({ size: "lg", variant: "outline" })}>
      {es.home.ctaBrowse}
    </Link>
  );
}

// Session read: render inside <Suspense>.
export default async function HeroActions() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <>
        <Link href="/signup" className={buttonVariants({ size: "lg" })}>
          {es.home.ctaSignup}
        </Link>
        <HeroActionsFallback />
      </>
    );
  }

  return (
    <>
      <Link href="/sell/new" className={buttonVariants({ size: "lg" })}>
        {es.home.ctaPublish}
      </Link>
      <Link href="/sell/scan" className={buttonVariants({ size: "lg", variant: "outline" })}>
        {es.scan.cta}
      </Link>
      <Link href="/cards" className={buttonVariants({ size: "lg", variant: "ghost" })}>
        {es.home.ctaBrowse}
      </Link>
    </>
  );
}
