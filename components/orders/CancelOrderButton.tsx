"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cancelOrderAction } from "@/lib/actions/orders";
import { es } from "@/lib/i18n/es";

export default function CancelOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const result = await cancelOrderAction(orderId);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      router.refresh();
    });
  }

  return (
    <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={onClick}>
      {es.orders.cancel}
    </Button>
  );
}
