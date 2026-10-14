import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

import CardOfferAction from "@/components/catalog/CardOfferAction";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { avatarInitials } from "@/lib/avatar";
import type { CartItem } from "@/lib/cart/store";
import { getPrintListings, type CardOfferFilters } from "@/lib/data/listings";
import { es } from "@/lib/i18n/es";
import { formatMXN } from "@/lib/money";
import { CONDITIONS, FINISHES, LANGUAGES } from "@/lib/schemas/listing";

type Props = { printId: string; cardPath: string; filters: CardOfferFilters };

// Plain GET form so filters live in the URL, like the catalog filters.
export default async function CardOffers({ printId, cardPath: path, filters }: Props) {
  const offers = await getPrintListings(printId, filters);
  const hasFilters = Boolean(filters.condition || filters.language || filters.finish);

  return (
    <section className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{es.catalog.offersTitle}</h2>
          {offers.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              {es.catalog.offersSummary(offers.length, formatMXN(offers[0].priceCents))}
            </p>
          ) : null}
        </div>
        <Link href={`/sell/new?card=${printId}`} className={buttonVariants({ variant: "outline" })}>
          {es.catalog.sellThisCard}
        </Link>
      </div>

      <form action={path} className="grid gap-2 sm:grid-cols-4">
        <NativeSelect name="condition" aria-label={es.listing.condition} defaultValue={filters.condition ?? ""}>
          <option value="">{es.listing.condition}</option>
          {CONDITIONS.map((value) => (
            <option key={value} value={value}>
              {es.listing.conditions[value]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="language" aria-label={es.listing.language} defaultValue={filters.language ?? ""}>
          <option value="">{es.listing.language}</option>
          {LANGUAGES.map((value) => (
            <option key={value} value={value}>
              {es.listing.languages[value]}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="finish" aria-label={es.listing.finish} defaultValue={filters.finish ?? ""}>
          <option value="">{es.listing.finish}</option>
          {FINISHES.map((value) => (
            <option key={value} value={value}>
              {es.listing.finishes[value]}
            </option>
          ))}
        </NativeSelect>
        <div className="flex gap-2">
          <Button type="submit">{es.catalog.apply}</Button>
          {hasFilters ? (
            <Link href={path} className={buttonVariants({ variant: "ghost" })}>
              {es.catalog.clear}
            </Link>
          ) : null}
        </div>
      </form>

      {offers.length === 0 ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          {hasFilters ? es.catalog.offersEmptyFiltered : es.catalog.offersEmpty}
        </p>
      ) : (
        <ul className="grid divide-y rounded-xl border">
          {offers.map((offer) => {
            const seller = offer.seller;
            const location = [seller.city, seller.state].filter(Boolean).join(", ");
            const item: CartItem = {
              id: offer.listingId,
              title: offer.title,
              priceCents: offer.priceCents,
              imageUrl: offer.photoUrls[0] ?? offer.cardImageUrl,
              quantity: 1,
              stock: offer.stock,
              slug: offer.printSlug,
            };
            return (
              <li
                key={offer.listingId}
                id={`listing-${offer.listingId}`}
                className="grid scroll-mt-20 gap-3 p-3 target:bg-muted/60 sm:grid-cols-[1fr_auto] sm:items-center"
              >
                <div className="grid gap-2">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <p className="text-base font-semibold">{formatMXN(offer.priceCents)}</p>
                    <Badge variant="secondary">
                      {es.listing.conditions[offer.condition as keyof typeof es.listing.conditions]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {[
                        es.listing.languages[offer.language as keyof typeof es.listing.languages],
                        es.listing.finishes[offer.finish as keyof typeof es.listing.finishes],
                        es.catalog.stock(offer.stock),
                      ].join(" · ")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Avatar>
                      {seller.avatar_url ? <AvatarImage src={seller.avatar_url} alt="" /> : null}
                      <AvatarFallback>{avatarInitials(seller.display_name, seller.username)}</AvatarFallback>
                    </Avatar>
                    <div className="grid">
                      <Link href={`/sellers/${encodeURIComponent(seller.username)}`} className="font-medium hover:underline">
                        {seller.display_name ?? seller.username}
                      </Link>
                      <span className="text-xs text-muted-foreground">
                        {[
                          seller.rating_count > 0
                            ? es.trust.ratings.summary(Number(seller.rating_avg).toFixed(1), seller.rating_count)
                            : es.trust.ratings.none,
                          location,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </div>
                  </div>
                  {offer.photoUrls.length > 0 ? (
                    <ul className="flex gap-2">
                      {offer.photoUrls.map((url, index) => (
                        <li key={url}>
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="relative block aspect-[5/7] w-14 overflow-hidden rounded-md bg-muted focus-visible:outline-2 focus-visible:outline-ring"
                          >
                            <Image
                              src={url}
                              alt={es.catalog.offerPhotoAlt(offer.title, index + 1)}
                              fill
                              sizes="56px"
                              className="object-cover"
                            />
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
                <Suspense fallback={<div className="h-9 w-40" aria-hidden />}>
                  <CardOfferAction item={item} sellerId={offer.sellerId} sellerUsername={seller.username} />
                </Suspense>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
