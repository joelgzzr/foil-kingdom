"use client";

import { Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, type KeyboardEvent } from "react";

import { Input } from "@/components/ui/input";
import { es } from "@/lib/i18n/es";

type Suggestion = {
  id: string;
  code: string;
  slug: string;
  name: string;
  rarity: string | null;
  variantLabel: string | null;
  imageUrl: string | null;
};

const MAX_SUGGESTIONS = 8;

export default function HeaderSearch() {
  const router = useRouter();
  const listId = useId();
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<Suggestion[]>([]);
  const [searched, setSearched] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const query = term.trim();
  const showDropdown = open && query.length >= 2 && searched;
  const suggestions = results.slice(0, MAX_SUGGESTIONS);
  // The last option is always "see all results".
  const optionCount = suggestions.length + 1;

  useEffect(() => {
    if (query.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/cards/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        setResults(response.ok ? await response.json() : []);
        setSearched(true);
        setActive(-1);
      } catch {
        // Aborted by a newer keystroke.
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const seeAll = () => {
    setOpen(false);
    router.push(`/cards?q=${encodeURIComponent(query)}`);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      // Cycles through -1 (input) and every option.
      const states = optionCount + 1;
      const delta = event.key === "ArrowDown" ? 1 : -1;
      setActive((current) => ((current + 1 + delta + states) % states) - 1);
    } else if (event.key === "Enter" && showDropdown && active >= 0 && active < suggestions.length) {
      event.preventDefault();
      setOpen(false);
      setTerm("");
      router.push(`/cards/${encodeURIComponent(suggestions[active].slug)}`);
    }
  };

  return (
    <form
      role="search"
      className="relative w-full"
      onSubmit={(event) => {
        event.preventDefault();
        if (query) seeAll();
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input
        type="search"
        value={term}
        onChange={(event) => {
          setTerm(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={es.nav.searchPlaceholder}
        aria-label={es.nav.search}
        role="combobox"
        aria-expanded={showDropdown}
        aria-controls={listId}
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        maxLength={60}
        className="pl-8"
      />
      {showDropdown ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-50 mt-1 grid max-h-96 divide-y overflow-y-auto rounded-lg border bg-popover text-popover-foreground shadow-lg"
        >
          {suggestions.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">{es.nav.searchEmpty}</li>
          ) : (
            suggestions.map((card, index) => (
              <li key={card.id} id={`${listId}-${index}`} role="option" aria-selected={active === index}>
                <Link
                  href={`/cards/${encodeURIComponent(card.slug)}`}
                  tabIndex={-1}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setOpen(false);
                    setTerm("");
                  }}
                  className={`flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted ${active === index ? "bg-muted" : ""}`}
                >
                  <span className="relative h-11 w-8 shrink-0 overflow-hidden rounded bg-muted">
                    {card.imageUrl ? <Image src={card.imageUrl} alt="" fill sizes="32px" className="object-cover" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{card.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {card.code}
                      {card.rarity ? ` · ${card.rarity}` : ""}
                      {card.variantLabel ? ` · ${card.variantLabel}` : ""}
                    </span>
                  </span>
                </Link>
              </li>
            ))
          )}
          <li id={`${listId}-${suggestions.length}`} role="option" aria-selected={active === suggestions.length}>
            <button
              type="submit"
              onMouseDown={(event) => event.preventDefault()}
              className={`w-full px-3 py-2 text-left text-sm text-primary hover:bg-muted ${active === suggestions.length ? "bg-muted" : ""}`}
            >
              {es.nav.searchAll} «{query}»
            </button>
          </li>
        </ul>
      ) : null}
    </form>
  );
}
