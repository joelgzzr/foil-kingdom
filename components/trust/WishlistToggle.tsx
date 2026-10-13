"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { addToWishlistAction, removeFromWishlistAction } from "@/lib/actions/wishlist";
import { es } from "@/lib/i18n/es";

export default function WishlistToggle({ printId, onList }: { printId: string; onList: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const result = await (onList ? removeFromWishlistAction(printId) : addToWishlistAction(printId));
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      router.refresh();
    });
  }

  return (
    <Button type="button" variant={onList ? "outline" : "default"} disabled={pending} onClick={onClick}>
      {onList ? es.trust.wishlist.remove : es.trust.wishlist.add}
    </Button>
  );
}
