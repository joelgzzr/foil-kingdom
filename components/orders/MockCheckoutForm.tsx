"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { confirmMockPaymentAction } from "@/lib/actions/orders";
import { es } from "@/lib/i18n/es";

export default function MockCheckoutForm({ paymentId }: { paymentId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function confirm(outcome: "approved" | "rejected") {
    startTransition(async () => {
      const result = await confirmMockPaymentAction(paymentId, outcome);
      if (!result.ok || !result.data) {
        toast.error(result.ok ? es.errors.generic : result.message);
        return;
      }
      router.push(`/messages/${result.data.conversationId}`);
    });
  }

  return (
    <div className="flex gap-2">
      <Button type="button" disabled={pending} onClick={() => confirm("approved")}>
        {es.orders.mock.pay}
      </Button>
      <Button type="button" variant="outline" disabled={pending} onClick={() => confirm("rejected")}>
        {es.orders.mock.reject}
      </Button>
    </div>
  );
}
