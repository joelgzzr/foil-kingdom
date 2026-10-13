import type { Metadata } from "next";
import { Suspense } from "react";

import WishlistItemRow from "@/components/trust/WishlistItemRow";
import { requireUser } from "@/lib/auth-guard";
import { getWishlist } from "@/lib/data/trust";
import { es } from "@/lib/i18n/es";

export const metadata: Metadata = { title: es.trust.wishlist.title };

async function WishlistList() {
  const user = await requireUser();
  const items = await getWishlist(user.id);

  if (items.length === 0) {
    return <p className="py-10 text-center text-muted-foreground">{es.trust.wishlist.empty}</p>;
  }
  return (
    <ul className="grid divide-y rounded-xl border">
      {items.map((entry) => (
        <WishlistItemRow key={entry.printId} entry={entry} />
      ))}
    </ul>
  );
}

export default function WishlistPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">{es.trust.wishlist.title}</h1>
      <p className="mb-4 text-sm text-muted-foreground">{es.trust.wishlist.description}</p>
      <Suspense fallback={<div className="h-48" aria-hidden />}>
        <WishlistList />
      </Suspense>
    </main>
  );
}
