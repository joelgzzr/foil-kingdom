"use client";

import { Children, type ReactNode } from "react";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  useCarousel,
} from "@/components/ui/carousel";

// Paged scrolling (no dragFree/trimmed snaps) so every page shows whole cards.
const OPTIONS = { align: "start", containScroll: "trimSnaps", slidesToScroll: "auto" } as const;

const ARROW_CLASS =
  "z-10 size-9 border-2 border-primary/40 bg-background text-primary shadow-lg hover:bg-primary hover:text-primary-foreground disabled:border-border disabled:text-muted-foreground disabled:opacity-60 [&_svg]:size-5";

// Arrows only when there is something to scroll to.
function CarouselArrows() {
  const { canScrollPrev, canScrollNext } = useCarousel();
  if (!canScrollPrev && !canScrollNext) return null;
  return (
    <>
      <CarouselPrevious size="icon" className={`-left-4 ${ARROW_CLASS}`} />
      <CarouselNext size="icon" className={`-right-4 ${ARROW_CLASS}`} />
    </>
  );
}

// Row of cards, 5 per page on desktop; swipe on touch, arrows on every size.
export default function CardCarousel({ children, label }: { children: ReactNode; label: string }) {
  return (
    // contain-inline-size: grid parents otherwise size to the slides' full width and overflow.
    <Carousel opts={OPTIONS} aria-label={label} className="contain-inline-size w-full">
      <CarouselContent className="-ml-2">
        {Children.map(children, (child) => (
          <CarouselItem className="basis-1/2 pl-2 sm:basis-1/3 md:basis-1/4 lg:basis-1/5">{child}</CarouselItem>
        ))}
      </CarouselContent>
      <CarouselArrows />
    </Carousel>
  );
}
