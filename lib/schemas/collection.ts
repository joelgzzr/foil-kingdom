export const COLLECTION_PAGE_SIZE = 15;

export type CollectionFilters = {
  q?: string;
  page: number;
};

type RawParams = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
const text = (value: string | undefined, max = 60) => value?.trim().slice(0, max) || undefined;

// Untrusted URL params in, validated filters out.
export function parseCollectionFilters(params: RawParams): CollectionFilters {
  return {
    q: text(first(params.q)),
    page: Math.max(1, Math.floor(Number(first(params.page))) || 1),
  };
}

// True when the visitor searched, so the featured row is replaced by plain results.
export function hasActiveCollectionFilters(filters: CollectionFilters) {
  return Boolean(filters.q);
}

export function collectionHref(basePath: string, filters: CollectionFilters, page: number) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}
