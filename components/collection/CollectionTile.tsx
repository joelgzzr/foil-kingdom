"use client";

import { useCollectionSelection } from "@/components/collection/CollectionSelection";
import ListingTile from "@/components/listings/ListingTile";
import type { ListingTileData } from "@/lib/data/listings";
import { es } from "@/lib/i18n/es";

// Listing tile with an optional selection checkbox, for buying several cards from one seller.
export default function CollectionTile({
  listing,
  selectable,
  priority = false,
}: {
  listing: ListingTileData;
  selectable: boolean;
  priority?: boolean;
}) {
  const { selected, toggle } = useCollectionSelection();
  const isSelected = selected.has(listing.id);

  return (
    <div className={`relative rounded-xl ${isSelected ? "ring-2 ring-primary" : ""}`}>
      <ListingTile listing={listing} priority={priority} />
      {selectable ? (
        <label className="absolute left-3 top-3 flex size-7 cursor-pointer items-center justify-center rounded-md bg-background/90 shadow">
          <input
            type="checkbox"
            className="size-4"
            checked={isSelected}
            onChange={() => toggle(listing.id)}
            aria-label={es.collection.select(listing.title)}
          />
        </label>
      ) : null}
    </div>
  );
}
