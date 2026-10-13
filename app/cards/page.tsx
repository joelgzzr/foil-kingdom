import type { Metadata } from "next";
import { Suspense } from "react";

import CardTile from "@/components/catalog/CardTile";
import CatalogFilters from "@/components/catalog/CatalogFilters";
import CatalogPagination from "@/components/catalog/CatalogPagination";
import { searchCards, type CardFilters } from "@/lib/data/catalog";
import { getPrintListingStats } from "@/lib/data/listings";
import { es } from "@/lib/i18n/es";

export const metadata: Metadata = {
  title: es.catalog.title,
  description: es.catalog.subtitle,
};

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

async function CatalogResults({ searchParams }: { searchParams: PageProps<"/cards">["searchParams"] }) {
  const params = await searchParams; // Next.js 16: searchParams is a Promise
  const filters: CardFilters = {
    q: first(params.q),
    color: first(params.color),
    type: first(params.type),
    rarity: first(params.rarity),
    set: first(params.set),
    listed: first(params.listed) === "1",
    baseOnly: first(params.base) === "1",
    eventsOnly: first(params.events) === "1",
    page: Number(first(params.page)) || 1,
  };
  const { cards, total, page, pageCount } = await searchCards(filters);
  const stats = await getPrintListingStats(cards.map((card) => card.id));

  return (
    <>
      <CatalogFilters filters={filters} />
      <p className="text-sm text-muted-foreground">{es.catalog.results(total)}</p>
      {cards.length === 0 ? (
        <p className="py-10 text-center text-muted-foreground">{es.catalog.empty}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {cards.map((card, index) => (
            <li key={card.id}>
              <CardTile card={card} stats={stats[card.id]} priority={index < 4} />
            </li>
          ))}
        </ul>
      )}
      <CatalogPagination filters={filters} page={page} pageCount={pageCount} />
    </>
  );
}

export default function CatalogPage({ searchParams }: PageProps<"/cards">) {
  return (
    <main className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{es.catalog.title}</h1>
        <p className="text-sm text-muted-foreground">{es.catalog.subtitle}</p>
      </header>
      <Suspense fallback={<div className="h-96" aria-hidden />}>
        <CatalogResults searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
