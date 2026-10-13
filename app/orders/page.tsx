import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth-guard";
import { getUserOrders } from "@/lib/data/orders";
import { es } from "@/lib/i18n/es";
import { formatMXN } from "@/lib/money";

export const metadata: Metadata = { title: es.orders.listTitle };

async function OrdersList() {
  const user = await requireUser();
  const orders = await getUserOrders();

  if (orders.length === 0) {
    return <p className="py-10 text-center text-muted-foreground">{es.orders.listEmpty}</p>;
  }

  return (
    <ul className="grid divide-y rounded-xl border">
      {orders.map((order) => (
        <li key={order.id}>
          <Link href={`/messages/${order.conversation_id}`} className="flex items-center gap-3 p-3 hover:bg-muted">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{order.listing_title}</p>
              <p className="text-xs text-muted-foreground">
                {order.buyer_id === user.id ? es.messages.roleBuyer : es.messages.roleSeller}
                {order.total_cents ? ` · ${formatMXN(order.total_cents)}` : ""}
              </p>
            </div>
            <Badge variant="secondary">{es.orders.status[order.status]}</Badge>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function OrdersPage() {
  return (
    <main className="mx-auto grid w-full max-w-2xl gap-4 px-4 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{es.orders.listTitle}</h1>
        <p className="text-sm text-muted-foreground">{es.orders.listSubtitle}</p>
      </header>
      <Suspense fallback={<div className="h-64" aria-hidden />}>
        <OrdersList />
      </Suspense>
    </main>
  );
}
