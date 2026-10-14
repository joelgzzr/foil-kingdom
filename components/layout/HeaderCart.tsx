"use client";

import { ShoppingCart } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { useAllCarts } from "@/lib/cart/use-cart";
import { es } from "@/lib/i18n/es";

// Link to the cart page with the total number of cards across all seller carts.
export default function HeaderCart() {
  const total = useAllCarts().reduce((sum, cart) => sum + cart.items.length, 0);
  const label = total > 0 ? `${es.cart.headerLabel} (${total})` : es.cart.headerLabel;

  return (
    <Link href="/cart" title={es.cart.headerLabel} aria-label={label} className={`${buttonVariants({ variant: "ghost", size: "icon" })} relative`}>
      <ShoppingCart className="size-4.5" aria-hidden />
      {total > 0 ? (
        <span
          aria-hidden
          className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium leading-none text-primary-foreground"
        >
          {total > 9 ? "9+" : total}
        </span>
      ) : null}
    </Link>
  );
}
