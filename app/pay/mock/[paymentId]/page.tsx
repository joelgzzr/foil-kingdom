import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import MockCheckoutForm from "@/components/orders/MockCheckoutForm";
import { requireUser } from "@/lib/auth-guard";
import { es } from "@/lib/i18n/es";
import { formatMXN } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: es.orders.mock.title, robots: { index: false } };

async function MockCheckout({ params }: { params: PageProps<"/pay/mock/[paymentId]">["params"] }) {
  const { paymentId } = await params;
  const user = await requireUser();
  const supabase = await createClient();
  const { data: payment } = await supabase
    .from("payments")
    .select("id, amount_cents, status, provider, orders!inner(listing_title, buyer_id)")
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment || payment.provider !== "mock" || payment.status !== "pending" || payment.orders.buyer_id !== user.id) notFound();

  return (
    <div className="grid gap-4 rounded-xl border p-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">{es.orders.mock.title}</h1>
        <p className="text-sm text-muted-foreground">{es.orders.mock.description}</p>
      </header>
      <p className="text-sm">{es.orders.checkoutDescription(payment.orders.listing_title)}</p>
      <p className="text-2xl font-semibold">{formatMXN(payment.amount_cents)}</p>
      <MockCheckoutForm paymentId={payment.id} />
    </div>
  );
}

export default function MockCheckoutPage({ params }: PageProps<"/pay/mock/[paymentId]">) {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-10">
      <Suspense fallback={<div className="h-48" aria-hidden />}>
        <MockCheckout params={params} />
      </Suspense>
    </main>
  );
}
