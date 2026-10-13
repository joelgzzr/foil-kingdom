"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { removeFromWishlistAction, updateWishlistMaxPriceAction } from "@/lib/actions/wishlist";
import type { WishlistEntry } from "@/lib/data/trust";
import { es } from "@/lib/i18n/es";

export default function WishlistItemRow({ entry }: { entry: WishlistEntry }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [price, setPrice] = useState(entry.maxPriceCents ? String(entry.maxPriceCents / 100) : "");

  function savePrice(event: React.FormEvent) {
    event.preventDefault();
    const value = price.trim() === "" ? null : Number(price);
    startTransition(async () => {
      const result = await updateWishlistMaxPriceAction(entry.printId, value);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await removeFromWishlistAction(entry.printId);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      router.refresh();
    });
  }

  return (
    <li className="flex flex-wrap items-center gap-3 p-3">
      <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded bg-muted">
        {entry.imageUrl ? <Image src={entry.imageUrl} alt={entry.name} fill sizes="44px" className="object-cover" /> : null}
      </div>
      <div className="min-w-0 flex-1">
        <Link href={`/cards/${encodeURIComponent(entry.slug)}`} className="text-sm font-medium underline">
          {entry.name}
        </Link>
        <p className="text-xs text-muted-foreground">
          {entry.code}
          {entry.variantLabel ? ` · ${entry.variantLabel}` : ""}
          {entry.rarity ? ` · ${entry.rarity}` : ""}
        </p>
      </div>
      <form onSubmit={savePrice} className="flex items-end gap-2">
        <Field id={`max-${entry.printId}`} label={es.trust.wishlist.maxPrice}>
          <Input
            id={`max-${entry.printId}`}
            type="number"
            inputMode="decimal"
            min={1}
            max={1000000}
            step="0.01"
            className="w-36"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
          />
        </Field>
        <Button type="submit" variant="outline" size="sm" disabled={pending}>
          {es.trust.wishlist.saveMaxPrice}
        </Button>
      </form>
      <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={remove}>
        {es.trust.wishlist.remove}
      </Button>
    </li>
  );
}
