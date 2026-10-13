"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { setListingFeaturedAction } from "@/lib/actions/listings";
import { es } from "@/lib/i18n/es";

// Pins a listing to the top of the seller's public collection.
export default function FeatureListingButton({ listingId, featured }: { listingId: string; featured: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const result = await setListingFeaturedAction(listingId, !featured);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      router.refresh();
    });
  }

  return (
    <Button type="button" size="sm" variant={featured ? "secondary" : "ghost"} className="mr-3 shrink-0" disabled={pending} aria-pressed={featured} onClick={onClick}>
      {featured ? es.collection.unpin : es.collection.pin}
    </Button>
  );
}
