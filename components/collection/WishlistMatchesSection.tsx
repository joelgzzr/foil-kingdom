import CollectionTile from "@/components/collection/CollectionTile";
import CardCarousel from "@/components/ui/card-carousel";
import { getSellerListingsForPrints } from "@/lib/data/listings";
import { getOpenConversationLinks } from "@/lib/data/messages";
import { getWishlist } from "@/lib/data/trust";
import { es } from "@/lib/i18n/es";

// Reads the viewer's wishlist; render inside <Suspense> on the cached seller page.
export default async function WishlistMatchesSection({ userId, sellerId }: { userId: string; sellerId: string }) {
  const wishlist = await getWishlist(userId);
  const [matches, conversationLinks] = await Promise.all([
    getSellerListingsForPrints(
      sellerId,
      wishlist.map((entry) => entry.printId),
    ),
    getOpenConversationLinks(userId),
  ]);
  if (matches.length === 0) return null;

  return (
    <section aria-labelledby="seller-wishlist-matches" className="grid gap-3 rounded-2xl border bg-muted/30 p-4 sm:p-5">
      <div>
        <h2 id="seller-wishlist-matches" className="text-lg font-semibold tracking-tight">
          {es.collection.wishlistMatches}
        </h2>
        <p className="text-sm text-muted-foreground">{es.collection.wishlistMatchesHint(matches.length)}</p>
      </div>
      <CardCarousel label={es.collection.wishlistMatches}>
        {matches.map((listing) => (
          <CollectionTile key={listing.id} listing={listing} selectable conversationId={conversationLinks[listing.id]} />
        ))}
      </CardCarousel>
    </section>
  );
}
