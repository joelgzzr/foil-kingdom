import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

import FeatureListingButton from "@/components/collection/FeatureListingButton";
import PublishScanDraftsButton from "@/components/scan/PublishScanDraftsButton";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { requireUser } from "@/lib/auth-guard";
import { getOwnListings, getSellerStanding } from "@/lib/data/listings";
import { es } from "@/lib/i18n/es";
import { formatMXN } from "@/lib/money";

export const metadata: Metadata = { title: es.listing.mineTitle };

async function MyListings() {
  const user = await requireUser();
  const [listings, standing] = await Promise.all([getOwnListings(user.id), getSellerStanding(user.id)]);

  const scanDrafts = listings.filter((listing) => listing.source === "scan" && listing.status === "draft").length;

  return (
    <div className="grid gap-4">
      {standing.phoneVerified ? null : (
        <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          {es.listing.phoneRequired}{" "}
          <Link href="/account" className="underline">
            {es.nav.account}
          </Link>
        </p>
      )}
      {scanDrafts > 0 ? <PublishScanDraftsButton count={scanDrafts} canPublish={standing.phoneVerified} /> : null}
      {listings.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">{es.listing.mineEmpty}</p>
      ) : (
        <ul className="grid divide-y rounded-xl border">
          {listings.map((listing) => (
            <li key={listing.id} className="flex items-center">
              <Link href={`/sell/${listing.id}`} className="flex min-w-0 flex-1 items-center gap-3 p-3 hover:bg-muted">
                <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded bg-muted">
                  {listing.imageUrl ? (
                    <Image src={listing.imageUrl} alt="" fill sizes="48px" className="object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{listing.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatMXN(listing.priceCents)} · {es.catalog.stock(listing.stock)}
                    {listing.source === "scan" ? ` · ${es.scan.fromScan}` : ""}
                  </p>
                </div>
                <Badge variant={listing.status === "active" ? "default" : "secondary"}>
                  {es.listing.statuses[listing.status]}
                </Badge>
              </Link>
              {listing.status === "active" ? <FeatureListingButton listingId={listing.id} featured={listing.featured} /> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function SellPage() {
  return (
    <main className="mx-auto grid w-full max-w-3xl gap-4 px-4 py-8">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{es.listing.mineTitle}</h1>
          <p className="text-sm text-muted-foreground">{es.listing.mineSubtitle}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Link href="/sell/scan" className={buttonVariants({ variant: "outline" })}>
            {es.scan.cta}
          </Link>
          <Link href="/sell/new" className={buttonVariants()}>
            {es.listing.create}
          </Link>
        </div>
      </header>
      <Suspense fallback={<div className="h-64" aria-hidden />}>
        <MyListings />
      </Suspense>
    </main>
  );
}
