import type { Metadata } from "next";
import { Suspense } from "react";

import ListingForm from "@/components/listings/ListingForm";
import { getPrintLabelById } from "@/lib/data/catalog";
import { es } from "@/lib/i18n/es";

export const metadata: Metadata = { title: es.listing.createTitle };

async function NewListingForm({ searchParams }: { searchParams: PageProps<"/sell/new">["searchParams"] }) {
  const { card } = await searchParams; // Next.js 16: searchParams is a Promise
  const preselected = typeof card === "string" ? await getPrintLabelById(card) : null;

  return <ListingForm defaultValues={preselected ? { printId: preselected.id, cardLabel: preselected.label } : undefined} />;
}

export default function NewListingPage({ searchParams }: PageProps<"/sell/new">) {
  return (
    <main className="mx-auto grid w-full max-w-2xl gap-4 px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">{es.listing.createTitle}</h1>
      <Suspense fallback={<div className="h-96" aria-hidden />}>
        <NewListingForm searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
