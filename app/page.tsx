import { Suspense } from "react";

import ColorBrowseSection from "@/components/home/ColorBrowseSection";
import FinalCtaSection from "@/components/home/FinalCtaSection";
import HeroActions, { HeroActionsFallback } from "@/components/home/HeroActions";
import HeroCardFan from "@/components/home/HeroCardFan";
import HowItWorksSection from "@/components/home/HowItWorksSection";
import RecentListingsSection from "@/components/home/RecentListingsSection";
import ScannerHighlightSection from "@/components/home/ScannerHighlightSection";
import TrustSection from "@/components/home/TrustSection";
import { es } from "@/lib/i18n/es";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <section className="relative overflow-hidden border-b">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -right-24 -top-24 size-[28rem] rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute -bottom-32 left-0 size-[24rem] rounded-full bg-cyan-400/20 blur-3xl" />
        </div>
        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 px-4 py-14 lg:grid-cols-2 lg:py-20">
          <div className="grid justify-items-start gap-5">
            <span className="rounded-full border bg-background/70 px-3 py-1 text-xs font-medium text-primary backdrop-blur">
              {es.home.heroEyebrow}
            </span>
            <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">{es.home.heroTitle}</h1>
            <p className="max-w-xl text-pretty text-lg text-muted-foreground">{es.home.heroBody}</p>
            <div className="flex flex-wrap gap-3">
              <Suspense fallback={<HeroActionsFallback />}>
                <HeroActions />
              </Suspense>
            </div>
          </div>
          <Suspense fallback={<div className="h-80 sm:h-96" aria-hidden />}>
            <HeroCardFan />
          </Suspense>
        </div>
      </section>

      <Suspense fallback={<div className="h-96" aria-hidden />}>
        <RecentListingsSection />
      </Suspense>
      <Suspense fallback={<div className="h-48" aria-hidden />}>
        <ColorBrowseSection />
      </Suspense>
      <HowItWorksSection />
      <ScannerHighlightSection />
      <TrustSection />
      <Suspense fallback={null}>
        <FinalCtaSection />
      </Suspense>
    </main>
  );
}
