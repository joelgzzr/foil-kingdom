import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import type { ListingTileData } from "@/lib/data/listings";
import { es } from "@/lib/i18n/es";
import { formatMXN } from "@/lib/money";

export default function ListingTile({ listing, priority = false }: { listing: ListingTileData; priority?: boolean }) {
  return (
    <Link
      href={`/listings/${listing.id}`}
      className="group flex flex-col gap-2 rounded-xl p-2 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
    >
      <div className="relative aspect-[5/7] overflow-hidden rounded-lg bg-muted">
        {listing.imageUrl ? (
          <Image
            src={listing.imageUrl}
            alt={listing.title}
            fill
            sizes="(min-width: 1024px) 16vw, (min-width: 640px) 25vw, 45vw"
            className="object-cover"
            priority={priority}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-2 text-center text-xs text-muted-foreground">
            {es.listing.noPhoto}
          </div>
        )}
      </div>
      <div className="grid gap-1">
        <p className="line-clamp-2 text-sm font-medium leading-tight">{listing.title}</p>
        <p className="text-base font-semibold">{formatMXN(listing.priceCents)}</p>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <Badge variant="secondary">{es.listing.conditions[listing.condition as keyof typeof es.listing.conditions]}</Badge>
          {listing.sellerState ? <span>{listing.sellerState}</span> : null}
        </div>
      </div>
    </Link>
  );
}
