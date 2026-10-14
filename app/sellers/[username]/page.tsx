import { CalendarDays, MapPin, Star } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import CollectionFilters from "@/components/collection/CollectionFilters";
import CollectionTile from "@/components/collection/CollectionTile";
import ShareCollectionButton from "@/components/collection/ShareCollectionButton";
import WishlistMatchesSection from "@/components/collection/WishlistMatchesSection";
import PageNav from "@/components/layout/PageNav";
import ReportSection from "@/components/trust/ReportSection";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import CardCarousel from "@/components/ui/card-carousel";
import { getCurrentUser } from "@/lib/auth-guard";
import { avatarInitials } from "@/lib/avatar";
import { getFeaturedListings, getSellerCollectionStats, searchSellerCollection } from "@/lib/data/listings";
import { getOpenConversationLinks } from "@/lib/data/messages";
import { getSellerProfile } from "@/lib/data/trust";
import { es } from "@/lib/i18n/es";
import { collectionHref, hasActiveCollectionFilters, parseCollectionFilters } from "@/lib/schemas/collection";

type Props = PageProps<"/sellers/[username]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  const seller = await getSellerProfile(decodeURIComponent(username));
  if (!seller) return {};

  const name = seller.profile.display_name ?? seller.profile.username;
  const stats = await getSellerCollectionStats(seller.profile.id);
  const title = es.collection.shareTitle(name);
  const description = es.collection.description(name, stats.listingCount);
  const path = `/sellers/${seller.profile.username}`;
  // The Open Graph image comes from the colocated opengraph-image route.
  return {
    title: name,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, type: "profile" },
    twitter: { card: "summary_large_image", title, description },
  };
}

async function SellerProfile({ params, searchParams }: { params: Props["params"]; searchParams: Props["searchParams"] }) {
  const [{ username }, query] = await Promise.all([params, searchParams]); // Next.js 16: both are Promises
  const seller = await getSellerProfile(decodeURIComponent(username));
  if (!seller) notFound();

  const { profile, ratings } = seller;
  const basePath = `/sellers/${profile.username}`;
  const filters = parseCollectionFilters(query);
  const filtered = hasActiveCollectionFilters(filters);
  const showFeatured = !filtered;

  const [viewer, stats, featured, results] = await Promise.all([
    getCurrentUser(),
    getSellerCollectionStats(profile.id),
    showFeatured ? getFeaturedListings(profile.id) : Promise.resolve([]),
    searchSellerCollection(profile.id, filters),
  ]);
  const isOwner = viewer?.id === profile.id;
  const conversationLinks = viewer && !isOwner ? await getOpenConversationLinks(viewer.id) : {};
  const location = [profile.city, profile.state].filter(Boolean).join(", ");
  const name = profile.display_name ?? profile.username;

  return (
    <div className="grid gap-8">
      <header className="overflow-hidden rounded-2xl border bg-card">
        <div className="h-28 bg-linear-to-br from-primary/30 via-primary/10 to-muted sm:h-36" aria-hidden />
        <div className="px-4 pb-5 sm:px-6">
          <div className="-mt-12 flex flex-wrap items-end justify-between gap-3 sm:-mt-14">
            <Avatar className="size-24 text-3xl ring-4 ring-card sm:size-28">
              {profile.avatar_url ? <AvatarImage src={profile.avatar_url} alt="" /> : null}
              <AvatarFallback className="text-3xl">{avatarInitials(profile.display_name, profile.username)}</AvatarFallback>
            </Avatar>
            <div className="flex flex-wrap items-center gap-2">
              <ShareCollectionButton title={es.collection.shareTitle(name)} path={basePath} />
              {isOwner ? (
                <Link href="/sell" className={buttonVariants({ variant: "outline", size: "sm" })}>
                  {es.collection.manage}
                </Link>
              ) : null}
            </div>
          </div>

          <div className="mt-3 grid gap-1">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{name}</h1>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span>@{profile.username}</span>
              {location ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" aria-hidden />
                  {location}
                </span>
              ) : null}
            </p>
          </div>

          {profile.bio ? <p className="mt-3 max-w-2xl whitespace-pre-line text-sm">{profile.bio}</p> : null}

          <ul className="mt-4 flex flex-wrap gap-2 text-sm">
            <li className="rounded-full border px-3 py-1">{es.collection.stats.listings(stats.listingCount)}</li>
            <li className="rounded-full border px-3 py-1">{es.collection.stats.copies(stats.totalCopies)}</li>
            <li className="inline-flex items-center gap-1 rounded-full border px-3 py-1">
              <Star className="size-3.5 text-amber-500" aria-hidden />
              {profile.rating_count > 0
                ? es.trust.ratings.summary(Number(profile.rating_avg).toFixed(1), profile.rating_count)
                : es.trust.ratings.none}
            </li>
            <li className="inline-flex items-center gap-1 rounded-full border px-3 py-1">
              <CalendarDays className="size-3.5" aria-hidden />
              {es.trust.seller.memberSince}{" "}
              {new Date(profile.created_at).toLocaleDateString("es-MX", { year: "numeric", month: "long" })}
            </li>
          </ul>

          {isOwner ? <p className="mt-3 text-xs text-muted-foreground">{es.collection.ownCollection}</p> : null}
          <div className="mt-3">
            <Suspense fallback={null}>
              <ReportSection
                targetType="user"
                targetId={profile.id}
                ownerId={profile.id}
                returnTo={`/sellers/${profile.username}`}
              />
            </Suspense>
          </div>
        </div>
      </header>

      {featured.length > 0 || (showFeatured && isOwner) ? (
        <section aria-labelledby="seller-featured" className="rounded-2xl border bg-muted/30 p-4 sm:p-5">
          <h2 id="seller-featured" className="text-lg font-semibold tracking-tight">
            {es.collection.featured}
          </h2>
          <p className="mb-3 text-sm text-muted-foreground">{es.collection.featuredHint}</p>
          {featured.length > 0 ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
              {featured.map((listing, index) => (
                <CollectionTile
                  key={listing.id}
                  listing={listing}
                  selectable={!isOwner}
                  conversationId={conversationLinks[listing.id]}
                  priority={index < 5}
                />
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              {es.collection.featuredEmptyOwner}{" "}
              <Link href="/sell" className="text-primary underline">
                {es.collection.manage}
              </Link>
            </p>
          )}
        </section>
      ) : null}

      {viewer && !isOwner && !filtered ? (
        <Suspense fallback={null}>
          <WishlistMatchesSection userId={viewer.id} sellerId={profile.id} />
        </Suspense>
      ) : null}

      <section aria-labelledby="seller-listings" className="grid gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="seller-listings" className="text-lg font-semibold tracking-tight">
              {es.collection.forSale}
            </h2>
            <p className="text-sm text-muted-foreground">
              {es.collection.results(results.total)}
              {isOwner ? "" : ` · ${es.collection.cartHint}`}
            </p>
          </div>
          <CollectionFilters basePath={basePath} filters={filters} />
        </div>
        {results.listings.length === 0 ? (
          <p className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
            {filtered ? es.collection.emptyFiltered : es.collection.empty}
          </p>
        ) : (
          <CardCarousel label={es.collection.forSale}>
            {results.listings.map((listing) => (
              <CollectionTile key={listing.id} listing={listing} selectable={!isOwner} conversationId={conversationLinks[listing.id]} />
            ))}
          </CardCarousel>
        )}
        <PageNav
          page={results.page}
          pageCount={results.pageCount}
          hrefForPage={(target) => collectionHref(basePath, filters, target)}
        />
      </section>

      <section aria-labelledby="seller-ratings" className="grid gap-3">
        <h2 id="seller-ratings" className="text-lg font-semibold tracking-tight">
          {es.trust.ratings.title}
        </h2>
        {ratings.length === 0 ? (
          <p className="rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">
            {es.trust.ratings.empty}
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {ratings.map((rating) => (
              <li key={rating.id} className="grid content-start gap-1 rounded-xl border bg-card p-3 text-sm">
                <p className="flex items-center justify-between gap-2">
                  <span className="text-amber-500" aria-label={es.trust.ratings.starsOption(rating.stars)}>
                    {"★".repeat(rating.stars)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(rating.created_at).toLocaleDateString("es-MX")}
                  </span>
                </p>
                {rating.comment ? <p className="whitespace-pre-line">{rating.comment}</p> : null}
                <p className="text-xs text-muted-foreground">{rating.rater.display_name ?? rating.rater.username}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function SellerProfilePage({ params, searchParams }: Props) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <Link href="/cards" className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground">
        ← {es.catalog.backToCatalog}
      </Link>
      <Suspense fallback={<div className="h-96" aria-hidden />}>
        <SellerProfile params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
