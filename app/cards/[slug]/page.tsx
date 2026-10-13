import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import CardOffers from "@/components/catalog/CardOffers";
import CardVersions from "@/components/catalog/CardVersions";
import WishlistSection from "@/components/trust/WishlistSection";
import { Badge } from "@/components/ui/badge";
import { getCardBySlug } from "@/lib/data/catalog";
import { es } from "@/lib/i18n/es";

type Props = PageProps<"/cards/[slug]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const card = await getCardBySlug(decodeURIComponent(slug));
  if (!card) return {};
  return { title: `${card.name} (${card.code})${card.variant_label ? ` · ${card.variant_label}` : ""}` };
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

async function CardDetail({ params, searchParams }: { params: Props["params"]; searchParams: Props["searchParams"] }) {
  const { slug } = await params; // Next.js 16: params is a Promise
  const card = await getCardBySlug(decodeURIComponent(slug));
  if (!card) notFound();
  const query = await searchParams;

  const stats: [string, string | number | null][] = [
    [es.catalog.level, card.level],
    [es.catalog.playCost, card.play_cost],
    [es.catalog.evolutionCost, card.evolution_cost],
    [es.catalog.dp, card.dp],
    [es.catalog.attribute, card.attribute],
    [es.catalog.form, card.form],
    [es.catalog.digiTypes, card.digi_types.join(", ") || null],
  ];

  return (
    <>
    <div className="grid gap-6 md:grid-cols-[minmax(0,320px)_1fr]">
      <div className="relative aspect-[5/7] w-full overflow-hidden rounded-xl bg-muted">
        {card.imageUrl ? (
          <Image
            src={card.imageUrl}
            alt={`${card.name} (${card.code})`}
            fill
            sizes="(min-width: 768px) 320px, 90vw"
            className="object-cover"
            priority
          />
        ) : (
          <div className="flex h-full items-center justify-center p-2 text-center text-sm text-muted-foreground">
            {es.catalog.noImage}
          </div>
        )}
      </div>
      <div className="grid content-start gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{card.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{card.code}</span>
            {card.variant_label ? <Badge>{card.variant_label}</Badge> : null}
            {card.rarity ? <Badge variant="secondary">{card.rarity}</Badge> : null}
            {card.card_type ? <Badge variant="outline">{card.card_type}</Badge> : null}
            {card.color ? <Badge variant="outline">{[card.color, card.color2].filter(Boolean).join(" / ")}</Badge> : null}
          </div>
        </div>

        <Suspense fallback={<div className="h-9" aria-hidden />}>
          <WishlistSection printId={card.id} returnTo={`/cards/${encodeURIComponent(card.slug)}`} />
        </Suspense>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          {stats
            .filter(([, value]) => value !== null)
            .map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
        </dl>

        {card.main_effect ? (
          <section>
            <h2 className="text-sm font-medium">{es.catalog.effect}</h2>
            <p className="whitespace-pre-line text-sm text-muted-foreground">{card.main_effect}</p>
          </section>
        ) : null}
        {card.source_effect ? (
          <section>
            <h2 className="text-sm font-medium">{es.catalog.sourceEffect}</h2>
            <p className="whitespace-pre-line text-sm text-muted-foreground">{card.source_effect}</p>
          </section>
        ) : null}

        {card.sets.length > 0 ? (
          <section>
            <h2 className="mb-1 text-sm font-medium">{es.catalog.sets}</h2>
            <ul className="flex flex-wrap gap-1.5">
              {card.sets.map((set) => (
                <li key={set.id}>
                  <Link href={`/cards?set=${set.id}`}>
                    <Badge variant="outline">{set.name}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
      <Suspense fallback={null}>
        <CardVersions code={card.code} currentSlug={card.slug} />
      </Suspense>
      <div className="mt-8">
        <CardOffers
          printId={card.id}
          cardPath={`/cards/${encodeURIComponent(card.slug)}`}
          filters={{ condition: first(query.condition), language: first(query.language), finish: first(query.finish) }}
        />
      </div>
    </>
  );
}

export default function CardDetailPage({ params, searchParams }: Props) {
  return (
    <main className="mx-auto w-full max-w-4xl gap-4 px-4 py-8">
      <Link href="/cards" className="mb-4 inline-block text-sm text-muted-foreground hover:text-foreground">
        ← {es.catalog.backToCatalog}
      </Link>
      <Suspense fallback={<div className="h-96" aria-hidden />}>
        <CardDetail params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
