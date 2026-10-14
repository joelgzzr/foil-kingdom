import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import ListingForm from "@/components/listings/ListingForm";
import ListingPhotosManager from "@/components/listings/ListingPhotosManager";
import ListingStatusControls from "@/components/listings/ListingStatusControls";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth-guard";
import { cardLabel } from "@/lib/card-label";
import { getOwnListing } from "@/lib/data/listings";
import { es } from "@/lib/i18n/es";
import type { ListingInput } from "@/lib/schemas/listing";

export const metadata: Metadata = { title: es.listing.manageTitle };

async function ManageListing({ params }: { params: PageProps<"/sell/[id]">["params"] }) {
  const { id } = await params;
  const user = await requireUser();
  const listing = await getOwnListing(id, user.id);
  const item = listing?.items[0];
  if (!listing || !item) notFound();

  const defaultValues: ListingInput = {
    printId: item.print_id,
    cardLabel: item.card_prints?.cards
      ? cardLabel(item.card_prints.cards.name, item.card_prints.cards.code, item.card_prints.variant_label)
      : "",
    // Values are constrained by CHECKs in the database.
    condition: item.condition as ListingInput["condition"],
    language: item.language as ListingInput["language"],
    finish: item.finish as ListingInput["finish"],
    quantity: item.quantity,
    price: listing.price_cents / 100,
  };

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{listing.title}</h1>
          <Badge variant={listing.status === "active" ? "default" : "secondary"}>
            {es.listing.statuses[listing.status]}
          </Badge>
        </div>
        {listing.status === "active" ? (
          <Link href={`/listings/${listing.id}`} className="text-sm underline">
            {es.listing.viewPublic}
          </Link>
        ) : null}
      </div>

      <ListingStatusControls listingId={listing.id} status={listing.status} />

      <Card>
        <CardHeader>
          <CardTitle>{es.listing.photos}</CardTitle>
        </CardHeader>
        <CardContent>
          <ListingPhotosManager listingId={listing.id} userId={user.id} photos={listing.photos} />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <ListingForm listingId={listing.id} defaultValues={defaultValues} />
        </CardContent>
      </Card>
    </div>
  );
}

export default function ManageListingPage({ params }: PageProps<"/sell/[id]">) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <Suspense fallback={<div className="h-96" aria-hidden />}>
        <ManageListing params={params} />
      </Suspense>
    </main>
  );
}
