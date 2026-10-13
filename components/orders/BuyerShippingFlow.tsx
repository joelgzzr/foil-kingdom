"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/native-select";
import { selectOrderQuoteAction, setOrderDestinationAction, startCheckoutAction } from "@/lib/actions/orders";
import type { ConversationOrder, UserAddressOption } from "@/lib/data/orders";
import { es } from "@/lib/i18n/es";
import { formatMXN } from "@/lib/money";

type Props = {
  order: Pick<ConversationOrder, "id" | "status" | "selected_quote_id" | "total_cents" | "quotes" | "destination_summary">;
  addresses: UserAddressOption[];
};

export default function BuyerShippingFlow({ order, addresses }: Props) {
  const router = useRouter();
  const copy = es.orders.buyer;
  const [pending, startTransition] = useTransition();
  const [addressId, setAddressId] = useState((addresses.find((address) => address.is_default) ?? addresses[0])?.id ?? "");

  function run(action: () => Promise<{ ok: boolean; message?: string }>, after?: () => void) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      after?.();
      router.refresh();
    });
  }

  function pay() {
    startTransition(async () => {
      const result = await startCheckoutAction(order.id);
      if (!result.ok || !result.data) {
        toast.error(result.ok ? es.errors.generic : result.message);
        return;
      }
      window.location.assign(result.data.url);
    });
  }

  if (addresses.length === 0) {
    return (
      <div className="grid gap-2">
        <p className="text-sm">{copy.noAddress}</p>
        <Link href="/account" className={buttonVariants({ variant: "outline", size: "sm" })}>
          {copy.addAddress}
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-56 flex-1">
          <Field id="destinationAddress" label={copy.addressTitle}>
            <NativeSelect id="destinationAddress" value={addressId} onChange={(event) => setAddressId(event.target.value)}>
              {addresses.map((address) => (
                <option key={address.id} value={address.id}>
                  {`${address.label ?? address.street} · ${address.municipality}, ${address.state} ${address.postal_code}`}
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>
        <Button type="button" variant="outline" disabled={pending || !addressId} onClick={() => run(() => setOrderDestinationAction(order.id, addressId))}>
          {copy.getQuotes}
        </Button>
      </div>

      {order.quotes.length > 0 ? (
        <div className="grid gap-2">
          <h3 className="text-sm font-medium">{copy.quotesTitle}</h3>
          <ul className="grid gap-2">
            {order.quotes.map((quote) => {
              const chosen = quote.id === order.selected_quote_id;
              return (
                <li key={quote.id} className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                  <div>
                    <p className="font-medium">{`${quote.carrier} ${quote.service}`}</p>
                    {quote.estimated_days ? <p className="text-xs text-muted-foreground">{copy.days(quote.estimated_days)}</p> : null}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{formatMXN(quote.price_cents)}</span>
                    <Button
                      type="button"
                      size="sm"
                      variant={chosen ? "secondary" : "outline"}
                      aria-pressed={chosen}
                      disabled={pending || chosen}
                      onClick={() => run(() => selectOrderQuoteAction(order.id, quote.id))}
                    >
                      {chosen ? copy.chosen : copy.choose}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {order.status === "awaiting_payment" && order.total_cents ? (
        <div>
          <Button type="button" disabled={pending} onClick={pay}>
            {`${copy.pay} · ${formatMXN(order.total_cents)}`}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
