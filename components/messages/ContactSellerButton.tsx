"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { startConversationAction } from "@/lib/actions/messages";
import { es } from "@/lib/i18n/es";

export default function ContactSellerButton({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const result = await startConversationAction([listingId]);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      router.push(`/messages/${(result.data as { id: string }).id}`);
    });
  }

  return (
    <Button size="lg" disabled={pending} onClick={onClick}>
      {es.messages.contactSeller}
    </Button>
  );
}
