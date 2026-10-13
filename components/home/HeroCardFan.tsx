import Image from "next/image";
import Link from "next/link";

import { getHeroCards } from "@/lib/data/home";
import { es } from "@/lib/i18n/es";

export default async function HeroCardFan() {
  const cards = await getHeroCards(5);
  if (cards.length === 0) return null;

  const middle = (cards.length - 1) / 2;

  return (
    <ul
      aria-label={es.home.heroCardsLabel}
      className="relative mx-auto h-80 w-full max-w-md [--step:3rem] sm:h-96 sm:[--step:4.5rem]"
    >
      {cards.map((card, index) => {
        const offset = index - middle;
        return (
          <li
            key={card.id}
            className="hero-card absolute left-1/2 top-1/2 w-36 sm:w-44"
            style={
              {
                "--i": offset,
                "--a": Math.abs(offset),
                zIndex: cards.length - Math.round(Math.abs(offset)),
              } as React.CSSProperties
            }
          >
            <Link
              href={`/cards/${encodeURIComponent(card.slug)}`}
              className="relative block aspect-[5/7] overflow-hidden rounded-xl bg-muted shadow-xl ring-1 ring-foreground/10"
            >
              <Image
                src={card.imageUrl}
                alt={`${card.name} (${card.code})`}
                fill
                sizes="(min-width: 640px) 11rem, 9rem"
                className="object-cover"
                priority={index === Math.floor(middle)}
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
