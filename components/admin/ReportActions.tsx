"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import OrderReasonDialog from "@/components/orders/OrderReasonDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resolveReportAction, revokeOrderAction } from "@/lib/actions/admin";
import { es } from "@/lib/i18n/es";

type Action = "dismiss" | "remove_listing" | "ban_user";

export default function ReportActions({ reportId, targetType }: { reportId: string; targetType: "listing" | "user" | "order" }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState("");

  function run(action: Action) {
    startTransition(async () => {
      const result = await resolveReportAction(reportId, { action, note });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-2">
      <Input
        aria-label={es.admin.note}
        placeholder={es.admin.note}
        value={note}
        maxLength={500}
        onChange={(event) => setNote(event.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => run("dismiss")}>
          {es.admin.dismiss}
        </Button>
        {targetType === "listing" ? (
          <Button type="button" variant="destructive" size="sm" disabled={pending} onClick={() => run("remove_listing")}>
            {es.admin.removeListing}
          </Button>
        ) : null}
        {targetType === "order" ? (
          <OrderReasonDialog
            trigger={es.admin.revokeOrder}
            triggerVariant="destructive"
            title={es.admin.revokeOrder}
            description={es.admin.revokeOrderHint}
            fieldLabel={es.admin.revokeReason}
            placeholder={es.orders.cancelDialog.reasonPlaceholder}
            submitLabel={es.admin.revokeOrder}
            requiredMessage={es.orders.cancelDialog.reasonRequired}
            minLength={5}
            maxLength={300}
            onSubmit={(reason) => revokeOrderAction(reportId, { reason })}
          />
        ) : null}
        <Button type="button" variant="destructive" size="sm" disabled={pending} onClick={() => run("ban_user")}>
          {es.admin.banUser}
        </Button>
      </div>
    </div>
  );
}
