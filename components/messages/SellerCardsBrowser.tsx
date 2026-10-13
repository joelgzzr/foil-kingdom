"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addConversationItemsAction } from "@/lib/actions/messages";
import type { ListingTileData } from "@/lib/data/listings";
import { es } from "@/lib/i18n/es";
import { formatMXN } from "@/lib/money";

type Page = { listings: ListingTileData[]; hasMore: boolean };

type Props = {
  conversationId: string;
  sellerId: string;
  featured: ListingTileData[];
  related: ListingTileData[];
  rest: Page;
  // Cards already in the conversation, and those plus the featured/related ones shown above.
  conversationIds: string[];
  sectionIds: string[];
  // How many more cards the conversation admits.
  slots: number;
};

const SEARCH_DELAY_MS = 300;

function BrowseTile({ listing, selected, onToggle }: { listing: ListingTileData; selected: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={es.messages.items.browser.select(listing.title)}
      onClick={onToggle}
      className={`group relative flex flex-col gap-1.5 rounded-xl p-1.5 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring ${selected ? "bg-muted ring-2 ring-primary" : ""}`}
    >
      <div className="relative aspect-[5/7] overflow-hidden rounded-lg bg-muted">
        {listing.imageUrl ? (
          <Image src={listing.imageUrl} alt="" fill sizes="(min-width: 1024px) 12vw, 30vw" className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center p-2 text-center text-xs text-muted-foreground">{es.listing.noPhoto}</div>
        )}
        <span
          aria-hidden
          className={`absolute left-1.5 top-1.5 flex size-5 items-center justify-center rounded-md border text-xs shadow ${selected ? "border-primary bg-primary text-primary-foreground" : "bg-background/90"}`}
        >
          {selected ? "✓" : ""}
        </span>
      </div>
      <p className="line-clamp-2 text-xs font-medium leading-tight">{listing.title}</p>
      <p className="text-sm font-semibold">{formatMXN(listing.priceCents)}</p>
    </button>
  );
}

function BrowseSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-2">
      <h3 className="text-sm font-medium">{title}</h3>
      {children}
    </section>
  );
}

const GRID = "grid grid-cols-3 gap-1 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4";

// Lets the buyer pick more cards from the seller without leaving the conversation; they are added in one step.
export default function SellerCardsBrowser({ conversationId, sellerId, featured, related, rest, conversationIds, sectionIds, slots }: Props) {
  const router = useRouter();
  const copy = es.messages.items.browser;
  const [adding, startAdding] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [restState, setRestState] = useState({ ...rest, page: 1 });
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<(Page & { q: string; page: number }) | null>(null);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef(0);

  useEffect(() => () => clearTimeout(timer.current), []);

  async function fetchPage(q: string, page: number): Promise<Page | null> {
    const ticket = ++latest.current;
    setLoading(true);
    try {
      const response = await fetch("/api/sellers/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sellerId, q: q || undefined, page, exclude: q ? conversationIds : sectionIds }),
      });
      if (!response.ok) throw new Error("request failed");
      const data = (await response.json()) as Page;
      return ticket === latest.current ? data : null;
    } catch {
      if (ticket === latest.current) toast.error(copy.loadError);
      return null;
    } finally {
      if (ticket === latest.current) setLoading(false);
    }
  }

  function onQueryChange(value: string) {
    setQuery(value);
    clearTimeout(timer.current);
    const q = value.trim();
    if (!q) {
      latest.current++;
      setLoading(false);
      setSearch(null);
      return;
    }
    timer.current = setTimeout(async () => {
      const data = await fetchPage(q, 1);
      if (data) setSearch({ ...data, q, page: 1 });
    }, SEARCH_DELAY_MS);
  }

  async function loadMore() {
    if (search) {
      const data = await fetchPage(search.q, search.page + 1);
      if (data) setSearch({ q: search.q, page: search.page + 1, hasMore: data.hasMore, listings: [...search.listings, ...data.listings] });
      return;
    }
    const data = await fetchPage("", restState.page + 1);
    if (data) setRestState({ page: restState.page + 1, hasMore: data.hasMore, listings: [...restState.listings, ...data.listings] });
  }

  function toggle(id: string) {
    if (!selected.has(id) && selected.size >= slots) {
      toast.error(copy.limitReached(slots));
      return;
    }
    setSelected((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  function onAdd() {
    startAdding(async () => {
      const result = await addConversationItemsAction(conversationId, [...selected]);
      if (!result.ok) {
        if (result.message) toast.error(result.message);
        router.refresh();
        return;
      }
      toast.success(copy.added);
      setSelected(new Set());
      router.refresh();
    });
  }

  const renderTiles = (tiles: ListingTileData[]) => (
    <div className={GRID}>
      {tiles.map((listing) => (
        <BrowseTile key={listing.id} listing={listing} selected={selected.has(listing.id)} onToggle={() => toggle(listing.id)} />
      ))}
    </div>
  );

  const visible = search ?? restState;
  const hasAnything = featured.length > 0 || related.length > 0 || rest.listings.length > 0;

  return (
    <section className="grid gap-4 rounded-xl border p-4" aria-labelledby="seller-browser-title">
      <header>
        <h2 id="seller-browser-title" className="font-medium">
          {copy.title}
        </h2>
        <p className="text-sm text-muted-foreground">{copy.subtitle}</p>
      </header>

      {hasAnything ? (
        <>
          <Input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={copy.searchPlaceholder}
            aria-label={copy.searchLabel}
            maxLength={60}
          />

          {search === null ? (
            <>
              {featured.length > 0 ? <BrowseSection title={copy.featured}>{renderTiles(featured)}</BrowseSection> : null}
              {related.length > 0 ? <BrowseSection title={copy.related}>{renderTiles(related)}</BrowseSection> : null}
              {restState.listings.length > 0 ? <BrowseSection title={copy.all}>{renderTiles(restState.listings)}</BrowseSection> : null}
            </>
          ) : (
            <BrowseSection title={copy.searchResults}>
              {search.listings.length > 0 ? renderTiles(search.listings) : <p className="text-sm text-muted-foreground">{copy.noResults}</p>}
            </BrowseSection>
          )}

          {visible.hasMore ? (
            <Button type="button" variant="outline" size="sm" disabled={loading} onClick={loadMore} className="justify-self-center">
              {loading ? copy.loading : copy.loadMore}
            </Button>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{copy.empty}</p>
      )}

      {selected.size > 0 ? (
        <div className="sticky bottom-4 z-10 flex items-center justify-between gap-2 rounded-xl border bg-background p-3 shadow-lg">
          <Badge variant="secondary">{selected.size}</Badge>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" size="sm" disabled={adding} onClick={() => setSelected(new Set())}>
              {copy.clear}
            </Button>
            <Button type="button" size="sm" disabled={adding} onClick={onAdd}>
              {copy.add(selected.size)}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
