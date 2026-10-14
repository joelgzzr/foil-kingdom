"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { markRefundedAction, retryLabelAction, unbanUserAction } from "@/lib/actions/admin";
import { es } from "@/lib/i18n/es";

type Props = { kind: "retry-label" | "unban" | "mark-refunded"; id: string };

const ACTIONS = { "retry-label": retryLabelAction, unban: unbanUserAction, "mark-refunded": markRefundedAction };
const LABELS = { "retry-label": es.admin.retryLabel, unban: es.admin.unban, "mark-refunded": es.admin.markRefunded };

export default function AdminRowButton({ kind, id }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const result = await ACTIONS[kind](id);
      if (!result.ok) toast.error(result.message);
      else toast.success(result.message);
      router.refresh();
    });
  }

  return (
    <Button type="button" variant="outline" size="sm" disabled={pending} onClick={onClick}>
      {LABELS[kind]}
    </Button>
  );
}
