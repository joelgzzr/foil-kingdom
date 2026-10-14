"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { toast } from "sonner";

import {
  cartKey,
  EMPTY_ALL_CARTS,
  EMPTY_CART,
  MAX_CART_ITEMS,
  parseAllCarts,
  parseCartItems,
  readAllCartsRaw,
  readCartRaw,
  subscribeCarts,
  writeCart,
  type CartItem,
} from "@/lib/cart/store";
import type { ListingTileData } from "@/lib/data/listings";
import { es } from "@/lib/i18n/es";

export type { CartItem };

export const cartItemFromTile = (tile: ListingTileData, quantity = 1): CartItem => ({
  id: tile.id,
  title: tile.title,
  priceCents: tile.priceCents,
  imageUrl: tile.imageUrl,
  quantity: Math.max(1, Math.min(quantity, tile.stock)),
  stock: tile.stock,
  slug: tile.printSlug,
});

export function useSellerCart(sellerUsername: string) {
  const key = cartKey(sellerUsername);
  const raw = useSyncExternalStore(subscribeCarts, () => readCartRaw(key), () => EMPTY_CART);
  const items = useMemo(() => parseCartItems(raw), [raw]);
  const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  const has = useCallback((listingId: string) => byId.has(listingId), [byId]);
  const quantityOf = useCallback((listingId: string) => byId.get(listingId)?.quantity ?? 0, [byId]);
  // Adding a listing that is already in the cart sets its quantity.
  const add = useCallback(
    (item: CartItem) => {
      const quantity = Math.max(1, Math.min(item.quantity, item.stock));
      if (byId.has(item.id)) {
        writeCart(key, items.map((entry) => (entry.id === item.id ? { ...item, quantity } : entry)));
        return;
      }
      if (items.length >= MAX_CART_ITEMS) {
        toast.error(es.cart.limitReached(MAX_CART_ITEMS));
        return;
      }
      writeCart(key, [...items, { ...item, quantity }]);
    },
    [byId, items, key],
  );
  const setQuantity = useCallback(
    (listingId: string, quantity: number) =>
      writeCart(
        key,
        items.map((item) =>
          item.id === listingId ? { ...item, quantity: Math.max(1, Math.min(Math.floor(quantity), item.stock)) } : item,
        ),
      ),
    [items, key],
  );
  const remove = useCallback((listingId: string) => writeCart(key, items.filter((item) => item.id !== listingId)), [items, key]);

  return { has, quantityOf, add, setQuantity, remove };
}

// Every seller's cart, for the header badge and the cart page.
export function useAllCarts() {
  const raw = useSyncExternalStore(subscribeCarts, readAllCartsRaw, () => EMPTY_ALL_CARTS);
  return useMemo(() => parseAllCarts(raw), [raw]);
}
