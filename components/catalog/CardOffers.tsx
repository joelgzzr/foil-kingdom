import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
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
          {offers.map((offer) => (
            <li key={offer.listingId}>
              <Link
                href={`/listings/${offer.listingId}`}
                className="flex flex-wrap items-center justify-between gap-3 p-3 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
              >
                <div className="grid gap-1">
                  <p className="text-base font-semibold">{formatMXN(offer.priceCents)}</p>
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <Badge variant="secondary">
                      {es.listing.conditions[offer.condition as keyof typeof es.listing.conditions]}
                    </Badge>
                    <span>{es.listing.languages[offer.language as keyof typeof es.listing.languages]}</span>
                    <span>·</span>
                    <span>{es.listing.finishes[offer.finish as keyof typeof es.listing.finishes]}</span>
                    <span>·</span>
                    <span>{es.catalog.stock(offer.stock)}</span>
                    {offer.hasPhotos ? <span>· {es.listing.photos}</span> : null}
                    {offer.acceptsOffers ? <span>· {es.listing.offersAccepted}</span> : null}
                  </div>
                </div>
                <div className="text-right text-sm">
                  <p>{offer.seller.display_name ?? offer.seller.username}</p>
                  <p className="text-xs text-muted-foreground">
                    {[
                      offer.seller.rating_count > 0
                        ? es.trust.ratings.summary(Number(offer.seller.rating_avg).toFixed(1), offer.seller.rating_count)
                        : es.trust.ratings.none,
                      offer.seller.state,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
