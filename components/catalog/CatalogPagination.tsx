import PageNav from "@/components/layout/PageNav";
import type { CardFilters } from "@/lib/data/catalog";

function pageHref(filters: CardFilters, page: number) {
  const params = new URLSearchParams();
  for (const key of ["q", "color", "type", "rarity", "set"] as const) {
    const value = filters[key];
    if (value) params.set(key, value);
  }
  if (filters.listed) params.set("listed", "1");
  if (filters.baseOnly) params.set("base", "1");
  if (filters.eventsOnly) params.set("events", "1");
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/cards?${query}` : "/cards";
}

export default function CatalogPagination({
  filters,
  page,
  pageCount,
}: {
  filters: CardFilters;
  page: number;
  pageCount: number;
}) {
  return <PageNav page={page} pageCount={pageCount} hrefForPage={(target) => pageHref(filters, target)} />;
}
