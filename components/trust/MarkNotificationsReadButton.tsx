"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { markNotificationsReadAction } from "@/lib/actions/notifications";
import { es } from "@/lib/i18n/es";

export default function MarkNotificationsReadButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await markNotificationsReadAction();
          router.refresh();
        })
      }
    >
      {es.trust.notifications.markAllRead}
    </Button>
  );
}
