import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import ContactSection from "@/components/messages/ContactSection";
import ReportSection from "@/components/trust/ReportSection";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { avatarInitials } from "@/lib/avatar";
import { getPublicListing } from "@/lib/data/listings";
import { es } from "@/lib/i18n/es";
import { formatMXN } from "@/lib/money";

type Props = PageProps<"/listings/[id]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const listing = await getPublicListing(id);
  return listing ? { title: listing.title, description: listing.description ?? undefined } : {};
}

async function ListingDetail({ params }: { params: Props["params"] }) {
  const { id } = await params; // Next.js 16: params is a Promise
  const listing = await getPublicListing(id);
  const item = listing?.items[0];
  if (!listing || !item) notFound();

  const seller = listing.profiles;
  const location = [seller.city, seller.state].filter(Boolean).join(", ");
  // Seller photos first; singles without photos show the catalog image.
  const images = listing.photos.length > 0
    ? listing.photos.map((photo) => photo.url)
    : item.cardImageUrl
      ? [item.cardImageUrl]
      : [];
  const cardHref = item.card_prints ? `/cards/${encodeURIComponent(item.card_prints.slug)}` : "/cards";

  return (
    <>
      <Link href={cardHref} className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground">
        ← {es.listing.backToCard}
      </Link>
      <div className="grid gap-6 md:grid-cols-[minmax(0,420px)_1fr]">
      <div className="grid gap-2">
        {images.length === 0 ? (
          <div className="flex aspect-[5/7] items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground">
            {es.listing.noPhoto}
          </div>
        ) : (
          images.map((url, index) => (
            <div key={url} className="relative aspect-[5/7] overflow-hidden rounded-xl bg-muted">
              <Image
                src={url}
                alt={`${listing.title} (${index + 1})`}
                fill
                sizes="(min-width: 768px) 420px, 90vw"
                className="object-cover"
                priority={index === 0}
              />
            </div>
          ))
        )}
      </div>

      <div className="grid content-start gap-4">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{listing.title}</h1>
          <p className="text-2xl font-semibold">{formatMXN(listing.price_cents)}</p>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="secondary">{es.listing.conditions[item.condition as keyof typeof es.listing.conditions]}</Badge>
            <span>{es.catalog.stock(item.quantity)}</span>
            {listing.accepts_offers ? <span>{es.listing.offersAccepted}</span> : null}
          </div>
        </div>

        {listing.description ? <p className="whitespace-pre-line text-sm">{listing.description}</p> : null}

        <p className="text-sm text-muted-foreground">
          {es.listing.languages[item.language as keyof typeof es.listing.languages]} ·{" "}
          {es.listing.finishes[item.finish as keyof typeof es.listing.finishes]}
        </p>

        <section className="grid gap-1 rounded-xl border p-3 text-sm">
          <h2 className="font-medium">{es.listing.seller}</h2>
          <div className="flex items-center gap-2">
            <Avatar>
              {seller.avatar_url ? <AvatarImage src={seller.avatar_url} alt="" /> : null}
              <AvatarFallback>{avatarInitials(seller.display_name, seller.username)}</AvatarFallback>
            </Avatar>
            <p>
              <Link href={`/sellers/${encodeURIComponent(seller.username)}`} className="underline">
                {seller.display_name ?? seller.username}
              </Link>{" "}
              <span className="text-muted-foreground">@{seller.username}</span>
            </p>
          </div>
          <p className="text-muted-foreground">
            {seller.rating_count > 0
              ? es.trust.ratings.summary(Number(seller.rating_avg).toFixed(1), seller.rating_count)
              : es.trust.ratings.none}
          </p>
          {location ? (
            <p className="text-muted-foreground">
              {es.listing.location}: {location}
            </p>
          ) : null}
        </section>

        <Suspense fallback={<div className="h-10" aria-hidden />}>
          <ContactSection listingId={listing.id} sellerId={listing.seller_id} />
        </Suspense>
        <Suspense fallback={null}>
          <ReportSection
            targetType="listing"
            targetId={listing.id}
            ownerId={listing.seller_id}
            returnTo={`/listings/${listing.id}`}
          />
        </Suspense>
      </div>
      </div>
    </>
  );
}

export default function ListingDetailPage({ params }: Props) {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <Suspense fallback={<div className="h-96" aria-hidden />}>
        <ListingDetail params={params} />
      </Suspense>
    </main>
  );
}
