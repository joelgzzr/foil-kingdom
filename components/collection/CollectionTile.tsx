"use client";

import { Check, ShoppingCart } from "lucide-react";
import Link from "next/link";

import ListingTile from "@/components/listings/ListingTile";
import { Button, buttonVariants } from "@/components/ui/button";
import { cartItemFromTile, useSellerCart } from "@/lib/cart/use-cart";
import type { ListingTileData } from "@/lib/data/listings";
import { es } from "@/lib/i18n/es";

// Listing tile with an optional add-to-cart button, for buying several cards from one seller.
export default function CollectionTile({
  listing,
  selectable,
  conversationId,
  priority = false,
}: {
  listing: ListingTileData;
  selectable: boolean;
  // Set when the viewer already negotiates this card, so it links there instead of the cart.
  conversationId?: string;
  priority?: boolean;
}) {
  const { has, add, remove } = useSellerCart(listing.sellerUsername);
  const inCart = has(listing.id);

  return (
    <div className={`grid gap-1 rounded-xl ${inCart ? "ring-2 ring-primary" : ""}`}>
      <ListingTile listing={listing} priority={priority} />
      {selectable && conversationId ? (
        <Link href={`/messages/${conversationId}`} className={`${buttonVariants({ size: "sm", variant: "secondary" })} mx-2 mb-2`}>
          {es.cart.inConversation}
        </Link>
      ) : selectable ? (
        <Button
          type="button"
          size="sm"
          variant={inCart ? "secondary" : "outline"}
          className="mx-2 mb-2"
          aria-pressed={inCart}
          onClick={() => (inCart ? remove(listing.id) : add(cartItemFromTile(listing)))}
        >
          {inCart ? <Check aria-hidden /> : <ShoppingCart aria-hidden />}
          {inCart ? es.cart.inCart : es.cart.add}
        </Button>
      ) : null}
    </div>
  );
}
