import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import CancelOrderButton from "@/components/orders/CancelOrderButton";
import ReportOrderProblemButton from "@/components/orders/ReportOrderProblemButton";
import RatingForm from "@/components/trust/RatingForm";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth-guard";
import { getOrderDetail } from "@/lib/data/orders";
import { es } from "@/lib/i18n/es";
import { formatMXN } from "@/lib/money";

export const metadata: Metadata = { title: es.orders.title };

const REPORTABLE = ["paid", "label_failed", "label_ready", "in_transit", "delivered"];
const HAS_LABEL = ["label_ready", "in_transit", "delivered"];

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("es-MX", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

async function OrderDetail({ params }: { params: PageProps<"/orders/[id]">["params"] }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const user = await requireUser();
  const order = await getOrderDetail(id, user.id);
  if (!order) notFound();

  const counterpart = order.role === "buyer" ? order.seller : order.buyer;
  const open = order.status === "awaiting_buyer" || order.status === "awaiting_payment";
  const canceller = order.cancelled_by === order.buyer_id ? order.buyer : order.seller;
  const events = [...(order.shipment?.shipment_events ?? [])].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));

  return (
    <>
      <header className="grid gap-1">
        <Link href={order.role === "buyer" ? "/orders" : "/orders?tab=sell"} className="text-sm text-muted-foreground underline">
          {es.orders.detail.back}
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{es.orders.title}</h1>
          <Badge variant={order.status === "label_failed" ? "destructive" : "secondary"}>{es.orders.status[order.status]}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {order.role === "buyer" ? es.orders.history.seller : es.orders.history.buyer}: {counterpart.display_name ?? counterpart.username} ·{" "}
          {formatDateTime(order.created_at)}
        </p>
      </header>

      {order.status === "cancelled" ? (
        <section className="grid gap-0.5 rounded-xl border p-4 text-sm">
          <p className="font-medium">{es.orders.cancelled}</p>
          {order.cancelled_by ? <p>{es.orders.detail.cancelledBy(canceller.display_name ?? canceller.username)}</p> : null}
          {order.cancel_reason ? <p className="text-muted-foreground">{es.orders.cancelReason(order.cancel_reason)}</p> : null}
        </section>
      ) : null}

      <section className="grid gap-2 rounded-xl border p-4" aria-labelledby="order-items-title">
        <h2 id="order-items-title" className="font-medium">
          {es.orders.itemsTitle}
        </h2>
        <ul className="grid gap-0.5 text-sm">
          {[...order.order_items]
            .sort((a, b) => a.created_at.localeCompare(b.created_at))
            .map((item) => (
              <li key={item.id}>{es.orders.itemLine(item.title, item.quantity)}</li>
            ))}
        </ul>
        <p className="text-sm text-muted-foreground">
          {es.orders.itemPrice(formatMXN(order.item_price_cents), order.order_items.reduce((sum, item) => sum + item.quantity, 0))}
        </p>
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
      </section>

      {order.shipment ? (
        <section className="grid gap-2 rounded-xl border p-4" aria-labelledby="order-tracking-title">
          <h2 id="order-tracking-title" className="font-medium">
            {es.orders.detail.events}
          </h2>
          <p className="text-sm">
            {es.orders.tracking}: <span className="font-mono">{order.shipment.tracking_number}</span> · {order.shipment.carrier} {order.shipment.service}
          </p>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">{es.orders.detail.noEvents}</p>
          ) : (
            <ol className="grid gap-1 text-sm">
              {events.map((event) => (
                <li key={`${event.status}-${event.occurred_at}`} className="flex flex-wrap justify-between gap-2">
                  <span>{event.description ?? es.orders.detail.eventStatus[event.status as keyof typeof es.orders.detail.eventStatus]}</span>
                  <time dateTime={event.occurred_at} className="text-muted-foreground">
                    {formatDateTime(event.occurred_at)}
                  </time>
                </li>
              ))}
            </ol>
          )}
        </section>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/messages/${order.conversation_id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
          {es.orders.history.viewChat}
        </Link>
        {order.role === "seller" && HAS_LABEL.includes(order.status) ? (
          <a href={`/api/orders/${order.id}/label`} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>
            {es.orders.downloadLabel}
          </a>
        ) : null}
        {open ? <CancelOrderButton orderId={order.id} /> : null}
        {REPORTABLE.includes(order.status) && !order.hasOpenReport ? <ReportOrderProblemButton orderId={order.id} /> : null}
      </div>
      {order.hasOpenReport ? <p className="text-sm text-muted-foreground">{es.orders.detail.reportOpen}</p> : null}

      {order.status === "delivered" && !order.hasRated ? <RatingForm orderId={order.id} /> : null}
    </>
  );
}

export default function OrderDetailPage(props: PageProps<"/orders/[id]">) {
  return (
    <main className="mx-auto grid w-full max-w-2xl gap-4 px-4 py-8">
      <Suspense fallback={<div className="h-64" aria-hidden />}>
        <OrderDetail params={props.params} />
      </Suspense>
    </main>
  );
}
