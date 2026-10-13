import { Suspense } from "react";

import BuyerShippingFlow from "@/components/orders/BuyerShippingFlow";
import CancelOrderButton from "@/components/orders/CancelOrderButton";
import CreateOrderForm from "@/components/orders/CreateOrderForm";
import OrderLiveRefresh from "@/components/orders/OrderLiveRefresh";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getConversationOrder, getUserAddresses } from "@/lib/data/orders";
import { es } from "@/lib/i18n/es";
import { formatMXN } from "@/lib/money";

type Props = {
  conversationId: string;
  userId: string;
  role: "buyer" | "seller";
  defaultPriceCents: number;
  // Seller can start an order only while the conversation has open cards.
  canCreate: boolean;
  totalCopies: number;
  hasUnavailableItems: boolean;
};

// Reads the session; render inside <Suspense>.
async function OrderPanelContent({ conversationId, userId, role, defaultPriceCents, canCreate, totalCopies, hasUnavailableItems }: Props) {
  const order = await getConversationOrder(conversationId);

  if (!order) {
    if (role !== "seller" || !canCreate) return <OrderLiveRefresh conversationId={conversationId} />;
    const addresses = await getUserAddresses(userId);
    return (
      <>
        <OrderLiveRefresh conversationId={conversationId} />
        <CreateOrderForm
          conversationId={conversationId}
          addresses={addresses}
          defaultPrice={defaultPriceCents / 100}
          totalCopies={totalCopies}
          hasUnavailableItems={hasUnavailableItems}
        />
      </>
    );
  }

  const open = order.status === "awaiting_buyer" || order.status === "awaiting_payment";
  const addresses = role === "buyer" && open ? await getUserAddresses(userId) : [];
  const hasLabel = order.status === "label_ready" || order.status === "in_transit" || order.status === "delivered";

  return (
    <section className="grid gap-3 rounded-xl border p-4" aria-labelledby="order-title">
      <OrderLiveRefresh conversationId={conversationId} />
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="order-title" className="font-medium">
          {es.orders.title}
        </h2>
        <Badge variant={order.status === "label_failed" ? "destructive" : "secondary"}>{es.orders.status[order.status]}</Badge>
      </header>

      <p className="text-sm text-muted-foreground">
        {es.orders.itemPrice(formatMXN(order.item_price_cents), order.order_items.reduce((sum, item) => sum + item.quantity, 0))}
      </p>
      <ul className="grid gap-0.5 text-sm" aria-label={es.orders.itemsTitle}>
        {[...order.order_items]
          .sort((a, b) => a.created_at.localeCompare(b.created_at))
          .map((item) => (
            <li key={item.id}>{es.orders.itemLine(item.title, item.quantity)}</li>
          ))}
      </ul>
      <p className="text-sm">
        {es.orders.route(order.origin_summary, order.destination_summary ?? "…")} · {es.orders.packages[order.package_preset as keyof typeof es.orders.packages]}
      </p>

      {order.charges.length > 0 ? (
        <dl className="grid gap-1 text-sm">
          {order.charges.map((charge) => (
            <div key={charge.kind} className="flex justify-between">
              <dt className="text-muted-foreground">{charge.description}</dt>
              <dd>{formatMXN(charge.amount_cents)}</dd>
            </div>
          ))}
          {order.total_cents ? (
            <div className="flex justify-between border-t pt-1 font-medium">
              <dt>{es.orders.shippingTotal}</dt>
              <dd>{formatMXN(order.total_cents)}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      {order.status === "label_failed" ? <p className="text-sm text-destructive">{es.orders.labelFailedHint}</p> : null}

      {order.shipment ? (
        <p className="text-sm">
          {es.orders.tracking}: <span className="font-mono">{order.shipment.tracking_number}</span> · {order.shipment.carrier} {order.shipment.service}
        </p>
      ) : null}

      {role === "seller" && hasLabel ? (
        <div>
          <a href={`/api/orders/${order.id}/label`} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
            {es.orders.downloadLabel}
          </a>
        </div>
      ) : null}

      {role === "buyer" && open ? <BuyerShippingFlow order={order} addresses={addresses} /> : null}

      {open ? (
        <div>
          <CancelOrderButton orderId={order.id} />
        </div>
      ) : null}
    </section>
  );
}

export default function OrderPanel(props: Props) {
  return (
    <Suspense fallback={<div className="h-24" aria-hidden />}>
      <OrderPanelContent {...props} />
    </Suspense>
  );
}
