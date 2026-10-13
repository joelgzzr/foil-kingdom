import type { Metadata } from "next";
import { Suspense } from "react";

import ScanFlow from "@/components/scan/ScanFlow";
import { requireUser } from "@/lib/auth-guard";
import { getOwnListedPrintIds, getSellerStanding } from "@/lib/data/listings";
import { es } from "@/lib/i18n/es";

export const metadata: Metadata = { title: es.scan.title };

async function ScanSection() {
  const user = await requireUser();
  const [standing, listedPrintIds] = await Promise.all([getSellerStanding(user.id), getOwnListedPrintIds(user.id)]);
  return <ScanFlow phoneVerified={standing.phoneVerified} listedPrintIds={listedPrintIds} />;
}

export default function ScanPage() {
  return (
    <main className="mx-auto grid w-full max-w-3xl gap-4 px-4 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{es.scan.title}</h1>
        <p className="text-sm text-muted-foreground">{es.scan.subtitle}</p>
      </header>
      <Suspense fallback={<div className="h-64" aria-hidden />}>
        <ScanSection />
      </Suspense>
    </main>
  );
}
