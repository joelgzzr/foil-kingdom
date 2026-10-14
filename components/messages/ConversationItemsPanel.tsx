"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { removeConversationItemAction, setConversationItemQuantityAction } from "@/lib/actions/messages";
import type { ConversationItemView } from "@/lib/data/messages";
import { es } from "@/lib/i18n/es";
import { formatMXN } from "@/lib/money";

type Props = {
  role: "buyer" | "seller";
  items: ConversationItemView[];
  listTotalCents: number;
  agreedTotalCents: number;
  hasAgreedBundle: boolean;
};

// Cards being negotiated in the conversation. Open items only: once an order is created they move to it.
export default function ConversationItemsPanel({ role, items, listTotalCents, agreedTotalCents, hasAgreedBundle }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const copy = es.messages.items;

  if (items.length === 0) return null;

  function run(action: () => Promise<{ ok: boolean; message?: string }>) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok && result.message) toast.error(result.message);
      router.refresh();
    });
  }

  const hasAgreement = hasAgreedBundle;

  return (
    <section className="grid gap-3 rounded-xl border p-4" aria-labelledby="conversation-items-title">
      <header>
        <h2 id="conversation-items-title" className="font-medium">
          {copy.title}
        </h2>
        <p className="text-sm text-muted-foreground">{copy.subtitle}</p>
      </header>

      <ul className="grid gap-3">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-3">
            <div className="relative aspect-[5/7] w-12 shrink-0 overflow-hidden rounded-md bg-muted">
              {item.imageUrl ? <Image src={item.imageUrl} alt="" fill sizes="48px" className="object-cover" /> : null}
            </div>
            <div className="grid min-w-0 flex-1 gap-1">
              {item.available ? (
                <Link href={`/listings/${item.listingId}`} className="line-clamp-2 text-sm font-medium leading-tight underline-offset-2 hover:underline">
                  {item.title}
                </Link>
              ) : (
                <p className="line-clamp-2 text-sm font-medium leading-tight">{item.title}</p>
              )}
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {item.unitPriceCents !== null ? <span>{copy.unitPrice(formatMXN(item.unitPriceCents))}</span> : null}
                {item.agreedPriceCents !== null ? <Badge variant="secondary">{copy.agreed(formatMXN(item.agreedPriceCents))}</Badge> : null}
                {!item.available ? <Badge variant="destructive">{copy.unavailable}</Badge> : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {role === "buyer" && item.available && item.stock > 1 ? (
                  <label className="flex items-center gap-1.5 text-xs">
                    {copy.quantity}
                    <select
                      className="h-8 rounded-md border bg-background px-1.5 text-sm"
                      value={item.quantity}
                      disabled={pending}
                      onChange={(event) => run(() => setConversationItemQuantityAction(item.id, Number(event.target.value)))}
                    >
                      {Array.from({ length: Math.min(item.stock, 99) }, (_, index) => index + 1).map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : item.quantity > 1 ? (
                  <span className="text-xs">{`${copy.quantity}: ${item.quantity}`}</span>
                ) : null}
                <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => run(() => removeConversationItemAction(item.id))}>
                  {copy.remove}
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <dl className="grid gap-1 border-t pt-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">{copy.listTotal}</dt>
          <dd>{formatMXN(listTotalCents)}</dd>
        </div>
        {hasAgreement ? (
          <div className="flex justify-between font-medium">
            <dt>{copy.agreedTotal}</dt>
            <dd>{formatMXN(agreedTotalCents)}</dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
