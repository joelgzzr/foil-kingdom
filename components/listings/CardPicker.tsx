"use client";

import { useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { cardLabel } from "@/lib/card-label";
import { es } from "@/lib/i18n/es";

export type PickedCard = {
  id: string;
  label: string;
  code: string;
  name: string;
  variantLabel: string | null;
  imageUrl: string | null;
};

type Result = {
  id: string;
  code: string;
  name: string;
  variantLabel: string | null;
  rarity: string | null;
  imageUrl: string | null;
};

export default function CardPicker({ id, onPick }: { id: string; onPick: (card: PickedCard) => void }) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (term.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/cards/search?q=${encodeURIComponent(term.trim())}`, {
          signal: controller.signal,
        });
        setResults(response.ok ? await response.json() : []);
        setSearched(true);
      } catch {
        // Aborted by a newer keystroke.
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term]);

  const showResults = term.trim().length >= 2;

  return (
    <div className="grid gap-1.5">
      <Input
        id={id}
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        placeholder={es.listing.searchCard}
        autoComplete="off"
        maxLength={60}
      />
      {showResults && searched ? (
        results.length === 0 ? (
          <p className="text-xs text-muted-foreground">{es.listing.noResults}</p>
        ) : (
          <ul className="grid divide-y rounded-lg border">
            {results.map((card) => (
              <li key={card.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() => {
                    onPick({
                      id: card.id,
                      label: cardLabel(card.name, card.code, card.variantLabel),
                      code: card.code,
                      name: card.name,
                      variantLabel: card.variantLabel,
                      imageUrl: card.imageUrl,
                    });
                    setTerm("");
                    setResults([]);
                    setSearched(false);
                  }}
                >
                  <span>
                    {card.name}
                    {card.variantLabel ? <span className="text-primary"> · {card.variantLabel}</span> : null}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {card.code}
                    {card.rarity ? ` · ${card.rarity}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}
