import Link from "next/link";

import HomeSection from "@/components/home/HomeSection";
import ListingTile from "@/components/listings/ListingTile";
import { buttonVariants } from "@/components/ui/button";
import CardCarousel from "@/components/ui/card-carousel";
import { getRecentListings } from "@/lib/data/listings";
import { es } from "@/lib/i18n/es";

export default async function RecentListingsSection() {
  const listings = await getRecentListings(8);

  return (
    <HomeSection
      title={es.home.recentTitle}
      subtitle={es.home.recentSubtitle}
      action={
        listings.length > 0 ? (
          <Link href="/cards?listed=1" className="text-sm text-primary hover:underline">
            {es.home.recentViewAll}
          </Link>
        ) : null
      }
    >
      {listings.length === 0 ? (
        <div className="grid justify-items-center gap-2 rounded-2xl border border-dashed p-10 text-center">
          <p className="font-medium">{es.home.recentEmptyTitle}</p>
          <p className="text-sm text-muted-foreground">{es.home.recentEmptyBody}</p>
          <Link href="/sell/new" className={buttonVariants({ className: "mt-2" })}>
            {es.home.ctaPublish}
          </Link>
        </div>
      ) : (
        <CardCarousel label={es.home.recentTitle}>
          {listings.map((listing) => (
            <ListingTile key={listing.id} listing={listing} />
          ))}
        </CardCarousel>
      )}
    </HomeSection>
  );
}
