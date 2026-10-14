import type { Metadata } from "next";
import { Suspense } from "react";

import CartSections from "@/components/cart/CartSections";
import { getCurrentUser } from "@/lib/auth-guard";
import { es } from "@/lib/i18n/es";

export const metadata: Metadata = { title: es.cart.title, robots: { index: false } };

// Reads the session, so it renders behind <Suspense>. The cart itself lives in the browser.
async function CartContent() {
  const user = await getCurrentUser();
  return <CartSections signedIn={Boolean(user)} />;
}

export default function CartPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">{es.cart.title}</h1>
      <p className="mb-6 text-sm text-muted-foreground">{es.cart.description}</p>
      <Suspense fallback={<div className="h-48" aria-hidden />}>
        <CartContent />
      </Suspense>
    </main>
  );
}
