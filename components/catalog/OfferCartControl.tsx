"use client";

import { Check, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { useSellerCart, type CartItem } from "@/lib/cart/use-cart";
import { es } from "@/lib/i18n/es";

// Quantity picker plus add-to-cart for one listing row; once added, the picker edits the cart line.
export default function OfferCartControl({ item, sellerUsername }: { item: CartItem; sellerUsername: string }) {
  const { has, quantityOf, add, setQuantity, remove } = useSellerCart(sellerUsername);
  const [pending, setPending] = useState(1);
  const inCart = has(item.id);
  const quantity = inCart ? quantityOf(item.id) : pending;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {item.stock > 1 ? (
        <NativeSelect
          aria-label={es.cart.quantityOf(item.title)}
          className="w-20"
          value={quantity}
          onChange={(event) => {
            const value = Number(event.target.value);
            if (inCart) setQuantity(item.id, value);
            else setPending(value);
          }}
        >
          {Array.from({ length: item.stock }, (_, index) => index + 1).map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </NativeSelect>
      ) : null}
      {inCart ? (
        <>
          <Link href="/cart" className={buttonVariants({ variant: "secondary" })}>
            <Check aria-hidden />
            {es.cart.viewCart}
          </Link>
          <Button type="button" variant="ghost" onClick={() => remove(item.id)}>
            {es.cart.remove}
          </Button>
        </>
      ) : (
        <Button type="button" variant="outline" onClick={() => add({ ...item, quantity: pending })}>
          <ShoppingCart aria-hidden />
          {es.cart.add}
        </Button>
      )}
    </div>
  );
}
