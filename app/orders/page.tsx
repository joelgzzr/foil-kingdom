import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/auth-guard";
import { getUserOrders, type OrderRole } from "@/lib/data/orders";
import { es } from "@/lib/i18n/es";
import { formatMXN } from "@/lib/money";

export const metadata: Metadata = { title: es.orders.listTitle };

const TABS: OrderRole[] = ["buy", "sell"];

async function OrdersList({ searchParams }: { searchParams: PageProps<"/orders">["searchParams"] }) {
  const { tab } = await searchParams;
  const role: OrderRole = tab === "sell" ? "sell" : "buy";
  const user = await requireUser();
  const orders = await getUserOrders(user.id, role);

  return (
    <>
      <nav aria-label={es.orders.listTitle} className="flex gap-1 rounded-lg bg-muted p-1 text-sm">
        {TABS.map((value) => (
          <Link
            key={value}
            href={value === "buy" ? "/orders" : "/orders?tab=sell"}
            aria-current={value === role ? "page" : undefined}
            className={`flex-1 rounded-md px-3 py-1.5 text-center ${value === role ? "bg-background font-medium shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
          >
            {es.orders.history.tabs[value]}
          </Link>
        ))}
      </nav>

      {orders.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">{role === "buy" ? es.orders.history.emptyBuy : es.orders.history.emptySell}</p>
      ) : (
        <ul className="grid divide-y rounded-xl border">
          {orders.map((order) => {
            const counterpart = role === "buy" ? order.seller : order.buyer;
            const cards = order.order_items.reduce((sum, item) => sum + item.quantity, 0);
            return (
              <li key={order.id}>
                <Link href={`/orders/${order.id}`} className="flex items-center gap-3 p-3 hover:bg-muted">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{order.listing_title}</p>
                    <p className="text-xs text-muted-foreground">
                      {role === "buy" ? es.orders.history.seller : es.orders.history.buyer}: {counterpart.display_name ?? counterpart.username} ·{" "}
                      {es.orders.history.cards(cards)} · {formatMXN(order.item_price_cents)}
                      {" · "}
                      {new Date(order.created_at).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <Badge variant={order.status === "cancelled" ? "outline" : "secondary"}>{es.orders.status[order.status]}</Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

export default function OrdersPage(props: PageProps<"/orders">) {
  return (
    <main className="mx-auto grid w-full max-w-2xl gap-4 px-4 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{es.orders.listTitle}</h1>
        <p className="text-sm text-muted-foreground">{es.orders.listSubtitle}</p>
      </header>
      <Suspense fallback={<div className="h-64" aria-hidden />}>
        <OrdersList searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}
