"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { retryLabelAction, unbanUserAction } from "@/lib/actions/admin";
import { es } from "@/lib/i18n/es";

type Props = { kind: "retry-label"; id: string } | { kind: "unban"; id: string };

export default function AdminRowButton({ kind, id }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const result = await (kind === "retry-label" ? retryLabelAction(id) : unbanUserAction(id));
      if (!result.ok) toast.error(result.message);
      else toast.success(result.message);
      router.refresh();
    });
  }

  return (
    <Button type="button" variant="outline" size="sm" disabled={pending} onClick={onClick}>
      {kind === "retry-label" ? es.admin.retryLabel : es.admin.unban}
    </Button>
  );
}
