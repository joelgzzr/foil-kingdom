import Link from "next/link";

import WishlistToggle from "@/components/trust/WishlistToggle";
import { buttonVariants } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth-guard";
import { getWishlistEntry } from "@/lib/data/trust";
import { es } from "@/lib/i18n/es";

// Reads the session; render inside <Suspense> on the cached card page.
export default async function WishlistSection({ printId, returnTo }: { printId: string; returnTo: string }) {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <Link href={`/login?next=${encodeURIComponent(returnTo)}`} className={buttonVariants({ variant: "outline" })}>
        {es.trust.wishlist.loginToAdd}
      </Link>
    );
  }
  const entry = await getWishlistEntry(user.id, printId);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <WishlistToggle printId={printId} onList={Boolean(entry)} />
      {entry ? (
        <Link href="/wishlist" className="text-sm text-muted-foreground underline">
          {es.trust.wishlist.title}
        </Link>
      ) : null}
    </div>
  );
}
