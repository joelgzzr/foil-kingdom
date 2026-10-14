"use client";

import { Star, Trash2, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";

import { Button, buttonVariants } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { startConversationAction } from "@/lib/actions/messages";
import { cartKey, parseAllCarts, parseCartItems, readAllCartsRaw, readCartRaw, writeCart } from "@/lib/cart/store";
import { cartItemFromTile, useAllCarts, type CartItem } from "@/lib/cart/use-cart";
import type { ListingTileData } from "@/lib/data/listings";
import type { CartSellerInfo } from "@/lib/data/trust";
import { es } from "@/lib/i18n/es";
import { formatMXN } from "@/lib/money";

type CartValidation = { listings: ListingTileData[]; sellers: CartSellerInfo[]; inConversation: string[] };

const subscribeNothing = () => () => {};

export default function CartSections({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const copy = es.cart;
  const carts = useAllCarts();
  // localStorage only exists in the browser, so the server render shows the loading state.
  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const [sellers, setSellers] = useState<Record<string, CartSellerInfo>>({});
  const [busySeller, setBusySeller] = useState<string | null>(null);
  const started = useRef(false);

  // Re-checks the carts against the catalog: drops unavailable cards and refreshes prices.
  async function revalidate(onlySeller?: string) {
    const current = parseAllCarts(readAllCartsRaw()).filter((cart) => !onlySeller || cart.sellerUsername === onlySeller);
    const ids = current.flatMap((cart) => cart.items.map((item) => item.id));
    if (ids.length === 0) return { ok: true, dropped: 0 };

    try {
      const response = await fetch("/api/sellers/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!response.ok) throw new Error("validate");
      const data = (await response.json()) as CartValidation;

      const byId = new Map(data.listings.map((listing) => [listing.id, listing]));
      const negotiated = new Set(data.inConversation);
      let dropped = 0;
      let alreadyNegotiated = 0;
      for (const cart of current) {
        const kept = cart.items.flatMap((item): CartItem[] => {
          const tile = byId.get(item.id);
          if (!tile || tile.sellerUsername !== cart.sellerUsername || tile.stock < 1) return [];
          if (negotiated.has(item.id)) {
            alreadyNegotiated += 1;
            return [];
          }
          return [cartItemFromTile(tile, item.quantity)];
        });
        dropped += cart.items.length - kept.length;
        if (JSON.stringify(kept) !== JSON.stringify(cart.items)) writeCart(cartKey(cart.sellerUsername), kept);
      }
      setSellers((previous) => ({ ...previous, ...Object.fromEntries(data.sellers.map((seller) => [seller.username, seller])) }));
      if (dropped - alreadyNegotiated > 0) toast.info(copy.unavailableRemoved(dropped - alreadyNegotiated));
      if (alreadyNegotiated > 0) toast.info(copy.alreadyInConversation(alreadyNegotiated));
      return { ok: true, dropped };
    } catch {
      toast.error(copy.validateError);
      return { ok: false, dropped: 0 };
    }
  }

  useEffect(() => {
    if (!hydrated || started.current) return;
    started.current = true;
    void revalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  async function startConversation(username: string) {
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent("/cart")}`);
      return;
    }
    setBusySeller(username);
    try {
      const check = await revalidate(username);
      if (!check.ok || check.dropped > 0) return;

      const lines = parseCartItems(readCartRaw(cartKey(username)));
      if (lines.length === 0) return;
      const result = await startConversationAction(
        lines.map((item) => item.id),
        lines.map((item) => item.quantity),
      );
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      writeCart(cartKey(username), []);
      router.push(`/messages/${(result.data as { id: string }).id}`);
    } finally {
      setBusySeller(null);
    }
  }

  if (!hydrated) return <div className="h-48" aria-hidden />;

  if (carts.length === 0) {
    return (
      <div className="grid justify-items-center gap-4 py-16 text-center">
        <p className="text-muted-foreground">{copy.empty}</p>
        <Link href="/cards" className={buttonVariants()}>
          {copy.browse}
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      {carts.map((cart) => {
        const seller = sellers[cart.sellerUsername];
        const subtotal = cart.items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);
        const copies = cart.items.reduce((sum, item) => sum + item.quantity, 0);
        const busy = busySeller === cart.sellerUsername;
        const location = seller ? [seller.city, seller.state].filter(Boolean).join(", ") : "";

        return (
          <section key={cart.sellerUsername} aria-label={`@${cart.sellerUsername}`} className="rounded-xl border">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
              <div className="min-w-0">
                <Link href={`/sellers/${encodeURIComponent(cart.sellerUsername)}`} className="block truncate font-medium hover:underline">
                  {seller?.displayName ? `${seller.displayName} · ` : ""}@{cart.sellerUsername}
                </Link>
                {seller ? (
                  <p className="flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
                    {location ? <span>{location}</span> : null}
                    <span className="inline-flex items-center gap-1">
                      <Star className="size-3" aria-hidden />
                      {seller.ratingCount > 0
                        ? es.trust.ratings.summary((seller.ratingAvg ?? 0).toFixed(1), seller.ratingCount)
                        : es.trust.ratings.none}
                    </span>
                  </p>
                ) : null}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => writeCart(cartKey(cart.sellerUsername), [])}
              >
                <Trash2 aria-hidden />
                {copy.removeSeller}
              </Button>
            </header>

            <ul className="divide-y">
              {cart.items.map((item) => (
                <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="relative aspect-[5/7] w-12 shrink-0 overflow-hidden rounded-md bg-muted">
                    {item.imageUrl ? (
                      <Image src={item.imageUrl} alt="" fill sizes="48px" className="object-cover" />
                    ) : (
                      <span className="flex h-full items-center justify-center text-center text-[10px] text-muted-foreground">
                        {copy.noImage}
                      </span>
                    )}
                  </div>
                  <Link
                    href={item.slug ? `/cards/${encodeURIComponent(item.slug)}#listing-${item.id}` : `/listings/${item.id}`}
                    className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
                  >
                    {item.title}
                  </Link>
                  <NativeSelect
                    aria-label={copy.quantityOf(item.title)}
                    className="w-20 shrink-0"
                    value={item.quantity}
                    disabled={busy}
                    onChange={(event) =>
                      writeCart(
                        cartKey(cart.sellerUsername),
                        cart.items.map((entry) =>
                          entry.id === item.id ? { ...entry, quantity: Number(event.target.value) } : entry,
                        ),
                      )
                    }
                  >
                    {Array.from({ length: item.stock }, (_, index) => index + 1).map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </NativeSelect>
                  <span className="shrink-0 text-sm font-semibold">{formatMXN(item.priceCents * item.quantity)}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={copy.removeItem(item.title)}
                    title={copy.removeItem(item.title)}
                    disabled={busy}
                    onClick={() =>
                      writeCart(
                        cartKey(cart.sellerUsername),
                        cart.items.filter((entry) => entry.id !== item.id),
                      )
                    }
                  >
                    <X aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>

            <footer className="grid gap-3 border-t px-4 py-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {copy.subtotal} · {copy.count(copies)}
                </span>
                <span className="text-base font-semibold">{formatMXN(subtotal)}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" disabled={busy} onClick={() => void startConversation(cart.sellerUsername)}>
                  {signedIn ? copy.startConversationWith(cart.sellerUsername) : copy.loginToContinue}
                </Button>
                <Link
                  href={`/sellers/${encodeURIComponent(cart.sellerUsername)}`}
                  className={buttonVariants({ variant: "outline" })}
                >
                  {copy.continueShopping}
                </Link>
              </div>
            </footer>
          </section>
        );
      })}
      <p className="text-center text-xs text-muted-foreground">{copy.paymentNote}</p>
    </div>
  );
}
