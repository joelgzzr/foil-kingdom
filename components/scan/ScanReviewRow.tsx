"use client";

import Image from "next/image";
import { useState } from "react";

import CardPicker, { type PickedCard } from "@/components/listings/CardPicker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { cardLabel } from "@/lib/card-label";
import { es } from "@/lib/i18n/es";
import { formatMXN } from "@/lib/money";
import type { ReviewCard } from "@/lib/scan/client-pipeline";
import type { ScanPrintOption } from "@/lib/scan/types";
import { CONDITIONS, LANGUAGES } from "@/lib/schemas/listing";

type Props = {
  card: ReviewCard;
  // Price per copy the card would get without a manual override; null when there is no reference price.
  suggestedPrice: number | null;
  marketPrice: number | null;
  // Market price in pesos of any print of this card, for comparing arts.
  artMarket: (option: ScanPrintOption) => number | null;
  alreadyListed: boolean;
  onChange: (patch: Partial<ReviewCard>) => void;
  onPickCard: (picked: PickedCard) => void;
};

export default function ScanReviewRow({ card, suggestedPrice, marketPrice, artMarket, alreadyListed, onChange, onPickCard }: Props) {
  const [searching, setSearching] = useState(false);
  const chosen = card.options.find((option) => option.printId === card.printId);
  const arts = chosen ? card.options.filter((option) => option.code === chosen.code) : [];
  const otherCards = card.options.filter((option) => option.isDefault && option.code !== chosen?.code);
  const price = card.priceOverride ?? suggestedPrice;
  const missingPrice = card.include && price === null;
  const idPrefix = `scan-${card.id}`;

  return (
    <li className="grid gap-3 rounded-xl border p-3 sm:grid-cols-[auto_1fr]">
      <div className="flex gap-2">
        <figure className="grid gap-1">
          {/* Local blob of the seller's own photo; next/image cannot optimize it. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={card.cropUrl} alt={es.scan.yourPhoto} className="aspect-[5/7] w-20 rounded-md bg-muted object-cover" />
          <figcaption className="text-center text-[11px] text-muted-foreground">{es.scan.yourPhoto}</figcaption>
        </figure>
        <figure className="grid gap-1">
          <div className="relative aspect-[5/7] w-20 overflow-hidden rounded-md bg-muted">
            {chosen?.imageUrl ? (
              <Image src={chosen.imageUrl} alt={chosen.name} fill sizes="80px" className="object-cover" />
            ) : null}
          </div>
          <figcaption className="text-center text-[11px] text-muted-foreground">{es.scan.catalogArt}</figcaption>
        </figure>
      </div>

      <div className="grid gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {chosen ? cardLabel(chosen.name, chosen.code, chosen.variantLabel) : (card.detectedName ?? es.scan.notFound)}
            </p>
            {chosen ? null : <p className="text-xs text-muted-foreground">{es.scan.notFound}</p>}
            {chosen && card.status === "suggested" ? <p className="text-xs text-muted-foreground">{es.scan.notSure}</p> : null}
            {alreadyListed ? <p className="text-xs text-amber-600">{es.scan.alreadyListed}</p> : null}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={card.status === "matched" ? "secondary" : "outline"}>
              {card.status === "matched" ? es.scan.detected : es.scan.needsReview}
            </Badge>
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={card.include}
                disabled={!card.printId}
                onChange={(event) => onChange({ include: event.target.checked })}
              />
              {es.scan.confirm}
            </label>
          </div>
        </div>

        {arts.length > 1 ? (
          <div className="grid gap-1.5">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{es.scan.pickArt}.</span> {es.scan.artHint}
            </p>
            <div className="flex flex-wrap gap-2">
              {arts.map((option) => {
                const market = artMarket(option);
                return (
                  <button
                    key={option.printId}
                    type="button"
                    aria-pressed={option.printId === card.printId}
                    onClick={() => onChange({ printId: option.printId, include: true })}
                    className="grid w-16 gap-1 rounded-md p-1 text-center text-[11px] leading-tight aria-pressed:bg-primary/10 aria-pressed:ring-2 aria-pressed:ring-primary"
                  >
                    <span className="relative block aspect-[5/7] overflow-hidden rounded bg-muted">
                      {option.imageUrl ? (
                        <Image src={option.imageUrl} alt="" fill sizes="64px" className="object-cover" />
                      ) : null}
                    </span>
                    <span className="line-clamp-2">{option.variantLabel ?? es.scan.baseArt}</span>
                    {market === null ? null : <span className="text-muted-foreground">{formatMXN(market * 100)}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {otherCards.length > 0 ? (
          <div className="grid gap-1.5">
            <p className="text-xs text-muted-foreground">{es.scan.otherCard}</p>
            <div className="flex flex-wrap gap-2">
              {otherCards.map((option) => (
                <button
                  key={option.printId}
                  type="button"
                  onClick={() => onChange({ printId: option.printId, include: true })}
                  className="grid w-16 gap-1 rounded-md p-1 text-center text-[11px] leading-tight"
                >
                  <span className="relative block aspect-[5/7] overflow-hidden rounded bg-muted">
                    {option.imageUrl ? (
                      <Image src={option.imageUrl} alt="" fill sizes="64px" className="object-cover" />
                    ) : null}
                  </span>
                  <span className="line-clamp-2">{cardLabel(option.name, option.code, null)}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <div className="grid gap-1">
            <label htmlFor={`${idPrefix}-condition`} className="text-xs text-muted-foreground">
              {es.scan.condition}
            </label>
            <NativeSelect
              id={`${idPrefix}-condition`}
              value={card.condition}
              onChange={(event) => onChange({ condition: event.target.value as ReviewCard["condition"] })}
            >
              {CONDITIONS.map((value) => (
                <option key={value} value={value}>
                  {es.listing.conditions[value]}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1">
            <label htmlFor={`${idPrefix}-finish`} className="text-xs text-muted-foreground">
              {es.scan.finish}
            </label>
            <NativeSelect
              id={`${idPrefix}-finish`}
              value={card.finish}
              onChange={(event) => onChange({ finish: event.target.value as ReviewCard["finish"] })}
            >
              <option value="regular">{es.listing.finishes.regular}</option>
              <option value="foil">{es.listing.finishes.foil}</option>
            </NativeSelect>
          </div>
          <div className="grid gap-1">
            <label htmlFor={`${idPrefix}-language`} className="text-xs text-muted-foreground">
              {es.listing.language}
            </label>
            <NativeSelect
              id={`${idPrefix}-language`}
              value={card.language}
              onChange={(event) => onChange({ language: event.target.value as ReviewCard["language"] })}
            >
              {LANGUAGES.map((value) => (
                <option key={value} value={value}>
                  {es.listing.languages[value]}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid gap-1">
            <label htmlFor={`${idPrefix}-quantity`} className="text-xs text-muted-foreground">
              {es.scan.quantity}
            </label>
            <Input
              id={`${idPrefix}-quantity`}
              type="number"
              inputMode="numeric"
              min={1}
              max={999}
              value={card.quantity}
              onChange={(event) => onChange({ quantity: Math.min(999, Math.max(1, Math.trunc(Number(event.target.value)) || 1)) })}
            />
          </div>
          <div className="grid gap-1">
            <label htmlFor={`${idPrefix}-price`} className="text-xs text-muted-foreground">
              {es.scan.price}
            </label>
            <Input
              id={`${idPrefix}-price`}
              type="number"
              inputMode="decimal"
              min={1}
              step="1"
              aria-invalid={missingPrice}
              value={price ?? ""}
              onChange={(event) => {
                const value = event.target.value;
                onChange({ priceOverride: value === "" ? null : Number(value) });
              }}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>{marketPrice === null ? es.scan.noMarket : es.scan.market(formatMXN(marketPrice * 100))}</span>
          <Button type="button" variant="ghost" size="sm" onClick={() => setSearching((value) => !value)}>
            {es.scan.changeCard}
          </Button>
        </div>
        {searching ? (
          <CardPicker
            id={`${idPrefix}-picker`}
            onPick={(picked) => {
              onPickCard(picked);
              setSearching(false);
            }}
          />
        ) : null}
      </div>
    </li>
  );
}
