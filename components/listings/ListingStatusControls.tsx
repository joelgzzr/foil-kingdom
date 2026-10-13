"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { deleteListingAction, setListingStatusAction } from "@/lib/actions/listings";
import { es } from "@/lib/i18n/es";

type Status = "draft" | "active" | "paused" | "sold" | "removed";

export default function ListingStatusControls({ listingId, status }: { listingId: string; status: Status }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function changeStatus(next: "active" | "paused" | "sold") {
    startTransition(async () => {
      const result = await setListingStatusAction(listingId, next);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      router.refresh();
    });
  }

  function remove() {
    startTransition(async () => {
      const result = await deleteListingAction(listingId);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      router.push("/sell");
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status === "draft" ? (
        <Button disabled={pending} onClick={() => changeStatus("active")}>
          {es.listing.publish}
        </Button>
      ) : null}
      {status === "paused" || status === "sold" ? (
        <Button disabled={pending} onClick={() => changeStatus("active")}>
          {es.listing.resume}
        </Button>
      ) : null}
      {status === "active" ? (
        <>
          <Button variant="outline" disabled={pending} onClick={() => changeStatus("paused")}>
            {es.listing.pause}
          </Button>
          <Button variant="outline" disabled={pending} onClick={() => changeStatus("sold")}>
            {es.listing.markSold}
          </Button>
        </>
      ) : null}
      {status === "draft" || status === "paused" ? (
        <Button variant="destructive" disabled={pending} onClick={remove}>
          {es.listing.delete}
        </Button>
      ) : null}
    </div>
  );
}
