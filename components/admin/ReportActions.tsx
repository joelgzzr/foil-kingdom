"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resolveReportAction } from "@/lib/actions/admin";
import { es } from "@/lib/i18n/es";

type Action = "dismiss" | "remove_listing" | "ban_user";

export default function ReportActions({ reportId, canRemoveListing }: { reportId: string; canRemoveListing: boolean }) {
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
        {canRemoveListing ? (
          <Button type="button" variant="destructive" size="sm" disabled={pending} onClick={() => run("remove_listing")}>
            {es.admin.removeListing}
          </Button>
        ) : null}
        <Button type="button" variant="destructive" size="sm" disabled={pending} onClick={() => run("ban_user")}>
          {es.admin.banUser}
        </Button>
      </div>
    </div>
  );
}
