import Image from "next/image";
import Link from "next/link";

import { getCardVersions } from "@/lib/data/catalog";
import { getPrintListingStats } from "@/lib/data/listings";
import { es } from "@/lib/i18n/es";
import { formatMXN } from "@/lib/money";
import { cn } from "@/lib/utils";

// Sibling prints (alternate arts, parallels, reprints) of the card being viewed, each with its own offers.
export default async function CardVersions({ code, currentSlug }: { code: string; currentSlug: string }) {
  const versions = await getCardVersions(code);
  if (versions.length < 2) return null;
  const stats = await getPrintListingStats(versions.map((version) => version.id));

  return (
    <section className="mt-8 grid gap-3">
      <h2 className="text-lg font-semibold">{es.catalog.versions}</h2>
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6">
        {versions.map((version) => {
          const label = version.label ?? es.catalog.baseVersion;
          const offer = stats[version.id];
          return (
            <li key={version.id}>
              <Link
                href={`/cards/${encodeURIComponent(version.slug)}`}
                aria-current={version.slug === currentSlug ? "page" : undefined}
                className={cn(
                  "flex flex-col gap-1 rounded-lg border p-1.5 text-xs transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring",
                  version.slug === currentSlug && "border-primary bg-muted",
                )}
              >
                <div className="relative aspect-[5/7] overflow-hidden rounded bg-muted">
                  {version.imageUrl ? (
                    <Image src={version.imageUrl} alt={label} fill sizes="(min-width: 768px) 120px, 30vw" className="object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center p-1 text-center text-muted-foreground">
                      {es.catalog.noImage}
                    </div>
                  )}
                </div>
                <span className="line-clamp-2 font-medium leading-tight">{label}</span>
                <span className="text-muted-foreground">
                  {offer ? es.catalog.fromPrice(formatMXN(offer.minPriceCents)) : es.catalog.noOffers}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
