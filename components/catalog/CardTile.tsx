import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { es } from "@/lib/i18n/es";
import type { CardSummary } from "@/lib/data/catalog";
import type { PrintListingStats } from "@/lib/data/listings";
import { formatMXN } from "@/lib/money";

export default function CardTile({
  card,
  stats,
  priority = false,
}: {
  card: CardSummary;
  stats?: PrintListingStats;
  priority?: boolean;
}) {
  return (
    <Link
      href={`/cards/${encodeURIComponent(card.slug)}`}
      className="group flex flex-col gap-2 rounded-xl p-2 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
    >
      <div className="relative aspect-[5/7] overflow-hidden rounded-lg bg-muted">
        {card.imageUrl ? (
          <Image
            src={card.imageUrl}
            alt={`${card.name} (${card.code})`}
            fill
            sizes="(min-width: 1024px) 16vw, (min-width: 640px) 25vw, 45vw"
            className="object-cover"
            priority={priority}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-2 text-center text-xs text-muted-foreground">
            {es.catalog.noImage}
          </div>
        )}
      </div>
      <div className="grid gap-1">
        <p className="line-clamp-2 text-sm font-medium leading-tight">{card.name}</p>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span>{card.code}</span>
          {card.rarity ? <Badge variant="secondary">{card.rarity}</Badge> : null}
        </div>
        {card.variantLabel ? <p className="line-clamp-1 text-xs font-medium text-primary">{card.variantLabel}</p> : null}
        {stats ? (
          <p className="text-sm">
            <span className="font-semibold">{es.catalog.fromPrice(formatMXN(stats.minPriceCents))}</span>{" "}
            <span className="text-xs text-muted-foreground">· {es.catalog.copies(stats.totalCopies)}</span>
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">{es.catalog.noOffers}</p>
        )}
      </div>
    </Link>
  );
}
